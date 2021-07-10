import makeDao from './chow-dao.mjs';
import WsServer from './ws-server.mjs';

import fs from 'fs';
import Path from 'path';
import util from 'util';

const {promisify} = util;

async function main(args) {
  const isClearOrders = args.length > 0 &&
    (args[0] === '-c' || args[0] === '--clear-orders');
  if (isClearOrders) args.shift();
  if (args.length < 1 || args[0].startsWith('-')) usage();
  const [mongoUrl, configPath, eateriesPath ] = args;
  const config = (await import(Path.join(process.cwd(), configPath))).default;
  let dao;
  try {
    dao = await setupDao(mongoUrl, isClearOrders, eateriesPath);
    if (dao.errors) exitOnErrors(dao);
    const server = new WsServer(dao, config);
    const { port, type } = await server.serve();
    console.log(`PID ${process.pid} ${type} server listening on port ${port}`);
    const terminate = () => {
      server.close(() => console.error('HTTP server stop'));
      dao.close();
    };
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig =>  process.on(sig, terminate));
  }
  catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export default function () { return main(process.argv.slice(2)); }

async function setupDao(mongoUrl, isClearOrders, eateriesPath) {
  const dao = await makeDao(mongoUrl);
  exitOnErrors(dao);
  if (isClearOrders) {
    const clear = await dao.clearOrders();
    exitOnErrors(clear);
  }
  if (eateriesPath) {
    const eateries = await readJson(eateriesPath);
    const load = await dao.loadEateries(eateries);
    exitOnErrors(load);
  }
  return dao;
}

async function readJson(path) {
  let text;
  try {
    text = await promisify(fs.readFile)(path, 'utf8');
    if (path.endsWith('.jsonl')) text = jsonlToJson(text);
  }
  catch (err) {
    return { errors: [ new AppError(`unable to read ${path}: ${err}`) ] };
  }
  try {
    return JSON.parse(text);
  }
  catch (err) {
    const msg = `unable to parse JSON from ${path}: ${err}`;
    return { errors: [ new AppError(msg) ] };
  }
}

function getPort(portStr) {
  let port;
  if (!/^\d+$/.test(portStr) || (port = Number(portStr)) < 1024) {
    usageError(`bad port ${portStr}: must be >= 1024`);
  }
  return port;
}

/** Output usage message to stderr and exit */
function usage() {
  const prog = Path.basename(process.argv[1]);
  console.error(`usage: ${prog} [-c|--clear-orders] MONGO_URL CONFIG ` +
		`[EATERIES_JSON_DATA_FILE]`);
  process.exit(1);
}

function usageError(err=null) {
  if (err) console.error(err);
  usage();
}

function exitOnErrors(result) {
  if (result.errors) {
    result.errors.forEach(e => console.error(e.message));
    process.exit(1);
  }
}

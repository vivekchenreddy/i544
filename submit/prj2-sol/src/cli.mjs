import makeDao from './chow-dao.mjs';

import fs from 'fs';
import Path from 'path';

/************************* Top level routine ***************************/

export default async function go() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();
  let chow;
  try {
    chow = await makeDao(args[0]);
    errors(chow);
    await processCommand(chow, args.slice(1));
  }
  finally {
    if (chow) chow.close();
  }
}

function usage() {
  console.error(`${Path.basename(process.argv[1])} CHOW_DB_URL CMD [ARG...]`);
  process.exit(1);
}

/************************ Command Processor ****************************/

//Table-driven command processor

async function processCommand(chow, [cmd, ...args]) {
  const camelCase =
	s => s.replaceAll(/\b./g, c => c.toUpperCase())
	      .replaceAll(/\W/g, '')
	      .replace(/^./, c => c.toLowerCase());
  const cmdInfo = COMMANDS[cmd];
  if (!cmdInfo) {
    console.error(`bad command "${cmd}"; valid commands are:`);
    help();
    process.exit(1);
  }
  else if (cmdInfo.args.length !== args.length) {
    console.error(`invalid arguments for "${cmd}":`);
    cmdHelp(cmd);
    process.exit(1);
  }
  const result = cmdInfo.cmd
	         ? await cmdInfo.cmd(chow, ...args)
      	         : await chow[camelCase(cmd)].apply(chow, args);
  errors(result);
  if (Array.isArray(result) || typeof result !== 'object' ||
	   Object.keys(result).length > 0) {
    console.log(JSON.stringify(result, null, 2));
  }
}

// command routines with special validation / handling requirements

async function editOrder(chow, orderId, itemId, nUnits) {
  if (!/^[-+]?\d+$/.test(nUnits)) error('N_UNITS must be an integer.');
  return await chow.editOrder(orderId, itemId, Number(nUnits));
}

async function loadEateries(chow, jsonPath) {
  let data;
  try {
    data = await readJson(jsonPath);
  }
  catch (err) {
    error(`cannot read JSON at path "${jsonPath}": ${err}`);
  }
  await chow.loadEateries(data);
  return {};
}

async function locateEateries(chow, cuisine, lat, lng, index, count) {
  const numRegex = /^[-+]?\d+(\.\d+)?$/;
  if (!numRegex.test(lat) || !numRegex.test(lng)) {
    error(`bad latitute / longitude ${lat} / ${lng}`);
  }
  if (![index, count].every(s => s.match(/^\d+$/))) {
    error(`bad index / count ${index} / ${count}`);
  }
  const loc = { lat: Number(lat), lng: Number(lng) };
  return await chow.locateEateries(cuisine, loc, Number(index), Number(count));
}

function cmdHelp(cmd) {
  const msg = `
    ${cmd} ${COMMANDS[cmd].args.join(' ')}
      ${COMMANDS[cmd].doc}
  `.trim();
  console.log(msg);
}

function help() {
  console.log(Object.entries(COMMANDS).map(([k, v]) => {
    return `  ${k} ${v.args.join(' ')}\n      ${v.doc.trim()}`;
  }).join('\n'));
  return {};
}

//command table which drives command processor.
const COMMANDS = {
  'new-order': {
    args: [ 'EATERY_ID', ],
    doc: 'create a new order from eatery EATERY_ID.',
  },
  'get-order': {
    args: [ 'ORDER_ID' ],
    doc: 'show details of order ORDER_ID',
  },
  'edit-order': {
    args: [ 'ORDER_ID', 'ITEM_ID', 'N_UNITS' ],
    doc: `
      edit order ORDER_ID by N_UNITS of item specified by ITEM_ID.
      N_UNITS should be positive to add items, negative to remove items.
    `,
    cmd: editOrder,
  },
  'remove-order': {
    args: [ 'ORDER_ID', ],
    doc: 'remove order ORDER_ID.',
  },
  'get-eatery': {
    args: [ 'EATERY_ID' ],
    doc: 'show details for eatery EATERY_ID.',
  },
  'load-eateries': {
    args: [ 'EATERY_JSON_PATH' ],
    doc: 'reset eatery data in db to data read from EATERY_JSON_PATH',
    cmd: loadEateries,
  },
  'locate-eateries': {
    args: [ 'CUISINE', 'LATITUDE', 'LONGITUDE', 'INDEX', 'COUNT', ],
    doc: `
      locate eateries for CUISINE sorted by increasing distance 
      from the location specified by LATITUDE, LONGITUDE.
    `,
    cmd: locateEateries,
  },
  help: {
    args: [],
    doc: 'print this message.',
    cmd: help,
  },
};



/******************************* Utilities *****************************/

function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}

function error(msg) { console.error(msg); process.exit(1); }

function errors(result) {
  if (result.errors) {
    for (const err of result.errors) { console.error(err.message); }
    process.exit(1);
  }
}

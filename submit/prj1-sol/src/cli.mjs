import chowMake from './chow-down.mjs';

import fs from 'fs';
import Path from 'path';
import readline from 'readline';

/************************* Top level routine ***************************/

const OUT_FMTS = [ 'text', 'js', 'json', 'json2' ]; 

export default async function go() {
  const args = process.argv.slice(2);
  if (args.length !== 1) usage();
  const jsonPath = args[0];
  const chowData = readJson(jsonPath);
  const chow = chowMake(chowData);
  await repl(chow);
}

function usage() {
  console.error(`${Path.basename(process.argv[1])} ` +
		`CHOW_DATA_JSON_PATH`);
  process.exit(1);
}

/******************************** REPL *********************************/

const PROMPT = '>> ';

const COMMANDS = {
  categories: {
    args: [ 'EATERY_ID' ],
    doc: 'show categories for EATERY_ID.',
  },
  help: {
    args: [],
    doc: 'print this message.',
  },
  locate: {
    args: [ 'CUISINE' ],
    doc: 'locate eateries for CUISINE.',
  },
  menu: {
    args: [ 'EATERY_ID', 'CATEGORY' ],
    doc: 'show menu for CATEGORY in eatery EATERY_ID.'
  },
};

async function repl(chow) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, //no ANSI terminal escapes
    prompt: PROMPT,
  });  
  rl.on('line', async (line) => await doLine(chow, line, rl));
  rl.prompt();
}


//handler for a line
async function doLine(chow, line, rl) {
  line = line.trim();
  if (line.length > 0) {
    const [cmd, args ] = splitLine(line);
    if (cmd) {
      if (cmd === 'help') {
	help();
      }
      else {
	const results =  chow[cmd].apply(chow, args);
	if (results._errors) {
	  for (const err of results._errors) { console.error(err.message); }
	}
	else {
	  console.log(JSON.stringify(results, null, 2));
	}
      }
    }
  }
  rl.prompt();
}

function splitLine(line) {
  const splits = line.split(/\s+/);
  const cmd = splits[0];
  let args = splits.slice(1);
  const cmdInfo = COMMANDS[cmd];
  if (!cmdInfo) {
    error(`unknown command ${cmd}`);
    return [];
  }
  else if (args.length < cmdInfo.args.length) {
    error(`command ${cmd} needs arguments ${cmdInfo.args.join(' ')}`);
    return [];
  }
  else if (args.length > cmdInfo.args.length) {
    const n = cmdInfo.args.length;
    args = args.slice(0, n - 1).concat(args.slice(n - 1).join(' '));
  }
  return [ cmd, args ];
}

function help() {
  console.log(Object.entries(COMMANDS).map(([k, v]) => {
    return `  ${k} ${v.args.join(' ')}:  ${v.doc}`;
  }).join('\n'));
}

/******************************* Utilities *****************************/

function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}

function error(msg) { console.error(msg); }

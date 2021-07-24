#!/usr/bin/env node

import express from 'express';
import fs from 'fs';
import https from 'https';
import Path from 'path';

const CERT_BASE = 'localhost';
  

function cdThisDir() {
  try {
    const path = new URL(import.meta.url).pathname;
    const dir = Path.dirname(path);
    process.chdir(dir);
  }
  catch (err) {
    console.error(`cannot cd to this dir: ${err}`);
    process.exit(1);
  }
}

function main(port) {
  cdThisDir();

  const app = express();
  app.use(express.static('statics'));
  https.createServer({
    key: fs.readFileSync(`${CERT_BASE}.key`),
    cert: fs.readFileSync(`${CERT_BASE}.cert`),
  }, app)
  .listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

if (process.argv.length !== 3 || !/^\d+$/.test(process.argv[2])) {
  console.error("usage: %s PORT", Path.basename(process.argv[1]));
  process.exit(1);
}
main(Number(process.argv[2]));

import makeDao from '../src/chow-dao.mjs';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { assert } from 'chai';

export async function setupDao() {
  const mongod = new MongoMemoryServer();
  const uri = await mongod.getUri();
  assert(mongod.getInstanceInfo(), `mongo memory server startup failed`);
  const dao = await makeDao(uri);
  dao._mongod = mongod;
  return dao;
}

export async function tearDownDao(dao) {
  await dao.close();
  await dao._mongod.stop();
  assert.equal(dao._mongod.getInstanceInfo(), false,
	       `mongo memory server stop failed`);
}

import { setupDao, tearDownDao } from './util.mjs'
import params from '../src/params.mjs';

import fs from 'fs';

import chai from 'chai';
const { assert } = chai;

const COURSE_DIR = `${process.env.HOME}/cs544`;
import ChowDao from "../src/chow-dao.mjs"
const dbUrl="mongodb://localhost:27017/chow";
const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

describe('Orders DAO', function() {
    let eateryId=123;
    let id;
    let chowDao;
    beforeEach(async ()=> {chowDao = await ChowDao(dbUrl)});
    it ('must create a new order', async function () {
        const results = await chowDao.newOrder(eateryId)
        id=results.id
        assert.notEqual(results, null);
    });
    it ('get the inserted order', async function () {
        const results = await chowDao.getOrder(id)
        assert.equal(results._id, id);
    });

    it ('edit the order add items by n changes', async function () {
        const results = await chowDao.editOrder(id,'abc',2)
        assert.equal(results.items['abc'], 2);
    });
    it ('edit the order add another item in the items array', async function () {

        const results = await chowDao.editOrder(id,'abc1',4)
        assert.equal(results.items['abc1'], 4);
    });

    it ('remove the order from the collection', async function () {
        const order = await chowDao.removeOrder(id);
        assert.notEqual(order, null);
    });
    it ('must return NOT_FOUND error with bad order id', async function () {
        const order = await chowDao.getOrder(id);
        assert.notEqual(order.errors.length, null);
    });
});



















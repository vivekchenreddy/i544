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
    var id;
    let chowDao;
    beforeEach(async ()=> {chowDao = await ChowDao(dbUrl)});
    it ('must create a new order', async function () {
        const results = await chowDao.newOrder(eateryId)
        id=results.id
        assert.equal(results.eateryId, eateryId);
    });
    it ('get the inserted order', async function () {
        const results = await chowDao.getOrder(id)
        assert.equal(results.id, id);
    });

    it ('should edit the order add items by n changes', async function () {
        const results = await chowDao.editOrder(id,'abc',2)
        const results2 = await chowDao.getOrder(id)
        assert.equal(results2.items['abc'], 2);
    });
    it ('edit the order add another item in the items array', async function () {

        const results = await chowDao.editOrder(id,'abc1',4)
        const results1 = await chowDao.editOrder(id,'abc1',4)
        const results2 = await chowDao.getOrder(id)
        assert.equal(results2.items['abc1'], 8);
    });

    it ('edit the order decrease the order amount should show BAD_REQUEST', async function () {

        const results = await chowDao.editOrder(id,'abc1',-1004)
        assert.isAbove(results.errors?.length, 0);
        assert.equal(results.errors[0].code, 'BAD_REQ');
    });

    it ('edit an order and decrement by n items', async function () {
        const results = await chowDao.editOrder(id,'abc1',-6)
        assert.equal(results.items['abc1'], 2);
    });

    it ('BAD_REQUEST if we send decrement operation for non existant item', async function () {
        const results = await chowDao.editOrder(id,'non existant item',-6)
        assert.isAbove(results.errors?.length, 0);
        assert.equal(results.errors[0].code, 'BAD_REQ');
    });

    it ('edit the order with n changes by n amount should delete the item in items', async function () {
        const results = await chowDao.editOrder(id,'abc1',-2)
        assert.equal(results.items['abc1'], null);
    });

    it('editing order with multiple items with different Item Ids should append ', async function () {
        const result = await chowDao.editOrder(id,'abcdefg',4);
        const result2 = await chowDao.editOrder(id,'hijklmn',3);
        const result3 = await chowDao.getOrder(id);
        assert.equal(result3.items['abcdefg'],4);
        assert.equal(result3.items['hijklmn'],3);
    });

    it ('edit the order with a non existing order number', async function () {
        const results = await chowDao.editOrder('nonExistantOrderId','abc1',-2)
        assert.equal(results.errors[0].code, 'NOT_FOUND');
    });

    it ('remove the order from the collection', async function () {
        const order = await chowDao.removeOrder(id);
        const orderFetch= await chowDao.getOrder(id)
        assert.equal(orderFetch.errors[0].code, 'NOT_FOUND');
    });

    it ('get NOT_FOUND error if we are removing non existant order', async function () {
        const order = await chowDao.removeOrder(id);
        assert.equal(order.errors[0].code, 'NOT_FOUND');
    });

    it ('must return NOT_FOUND error with bad order id', async function () {
        const order = await chowDao.getOrder(id);
        assert.isAbove(order.errors?.length, 0);
        assert.equal(order.errors[0].code, 'NOT_FOUND');
    });
});



















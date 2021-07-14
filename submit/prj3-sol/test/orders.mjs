import { setupDao, tearDownDao } from './util.mjs'

import chai from 'chai';
const { assert } = chai;

describe('orders DAO', function() {

  const EATERY_ID = '123';
  const ITEM_ID0 = 'some-item';
  const ITEM_ID1 = 'some-other-item';
  const ITEM_ID2 = 'yet-another-item';

  let dao;

  beforeEach(async () => {
    dao = await setupDao();
  });

  afterEach(async () => {
    await tearDownDao(dao);
  });

  it ('must create a new order', async function () {
    const order = await dao.newOrder(EATERY_ID);
    assert.isNotEmpty(order.id);
  });

  it ('must create a new order with specified eatery id', async function () {
    const order = await dao.newOrder(EATERY_ID);
    assert.equal(order.eateryId, EATERY_ID);
  });

  it ('must allow retrieving an existing order', async function () {
    const order = await dao.newOrder(EATERY_ID);
    const readOrder = await dao.getOrder(order.id);
    assert.equal(readOrder.id, order.id);
  });

  it ('must return NOT_FOUND when retrieving a bad order', async function () {
    const readOrder = await dao.getOrder('bad');
    assert.equal(readOrder.errors[0].code, 'NOT_FOUND');
  });

  
  it ('must delete an existing order', async function () {
    const order = await dao.newOrder(EATERY_ID);
    const readOrder = await dao.getOrder(order.id);
    assert.equal(readOrder.id, order.id);
    await dao.removeOrder(order.id);
    const deletedOrder = await dao.getOrder(order.id);
    assert.equal(deletedOrder.errors[0].code, 'NOT_FOUND');
  });

  it ('must return NOT_FOUND when removing a bad order', async function () {
    const deletedOrder = await dao.removeOrder('bad');
    assert.equal(deletedOrder.errors[0].code, 'NOT_FOUND');
  });

  it ('must be able to add a new order item', async function () {
    const order = await dao.newOrder(EATERY_ID);
    await dao.editOrder(order.id, ITEM_ID0, 2);
    const read = await dao.getOrder(order.id);
    assert.equal(read.items[ITEM_ID0], 2);
  });

  it ('must be able to set order item quantity', async function () {
    const order = await dao.newOrder(EATERY_ID);
    await dao.editOrder(order.id, ITEM_ID0, 3);
    const read = await dao.getOrder(order.id);
    assert.equal(read.items[ITEM_ID0], 3);
  });

  it ('must be able to remove an order item', async function () {
    const order = await dao.newOrder(EATERY_ID);
    await dao.editOrder(order.id, ITEM_ID0, 2);
    await dao.editOrder(order.id, ITEM_ID0, 0);
    const read = await dao.getOrder(order.id);
    assert.isUndefined(read.items[ITEM_ID0]);
  });

  it ('must be able to edit an order with multiple items', async function () {
    const order = await dao.newOrder(EATERY_ID);
    await dao.editOrder(order.id, ITEM_ID0, 2);
    await dao.editOrder(order.id, ITEM_ID1, 3);
    await dao.editOrder(order.id, ITEM_ID2, 1);

    await dao.editOrder(order.id, ITEM_ID0, 3);
    await dao.editOrder(order.id, ITEM_ID1, 2);
    await dao.editOrder(order.id, ITEM_ID2, 0);
    
    const read = await dao.getOrder(order.id);
    assert.deepEqual(read.items, { [ITEM_ID0]: 3, [ITEM_ID1]: 2 });
  });

  it ('must return NOT_FOUND editing a non-existent order', async function () {
    const edited = await dao.editOrder('bad', ITEM_ID0, 2);
    assert.equal(edited.errors[0].code, 'NOT_FOUND');
  });  

});	


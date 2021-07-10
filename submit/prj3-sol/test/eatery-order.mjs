import makeEateryOrder from '../src/eatery-order.mjs';
import xEatery from '../src/xeatery.mjs';
import fs from 'fs';

import chai from 'chai';
const { assert } = chai;

const COURSE_DIR = `${process.env.HOME}/cs544`;
const DATA_PATH = `${COURSE_DIR}/data/chow-down1.json`;
const DATA = readJson(DATA_PATH);

//specific eatery and id's used for testing
const EATERY_ID1 = '50_43';
const XEATERY1 = xEatery(DATA.find(eatery => eatery.id === EATERY_ID1));
const ITEM_ID1 = '254_13';
const XITEM1 = XEATERY1.flatMenu[ITEM_ID1]; 
const ITEM_ID2 = '243_68';
const XITEM2 = XEATERY1.flatMenu[ITEM_ID2]; 

const EATERY1_ORDER_BASE =
  Object.fromEntries(['name', 'loc', 'cuisine'].map(k => [k, XEATERY1[k]]));

describe ('eatery-order', function() {



  it ('must return eatery-order for an empty order', function () {
    const order = { id: 'someOrderId', eateryId: EATERY_ID1 };
    const eateryOrder = makeEateryOrder(XEATERY1, order);
    assert.deepEqual(eateryOrder, {
      ...order, ...EATERY1_ORDER_BASE,
      items: [], total: 0,
    });
  });

  it ('must return complete item details for each order item', function () {
    const order = {
      id: 'someOrderId',
      eateryId: EATERY_ID1, 
      items: { [ITEM_ID1]: 1, [ITEM_ID2]: 2 },
    };
    const eateryOrder = makeEateryOrder(XEATERY1, order);
    const expectedItems = [
      { ...XITEM1, quantity: 1, quantityPrice: XITEM1.price },
      { ...XITEM2, quantity: 2, quantityPrice: 2*XITEM2.price },
    ];
    assert.deepEqual(eateryOrder.items, expectedItems);
  });

  it ('must return a correct total with a single item order', function () {
    const order = {
      id: 'someOrderId',
      eateryId: EATERY_ID1, 
      items: { [ITEM_ID1]: 1,  },
    };
    const eateryOrder = makeEateryOrder(XEATERY1, order);
    assert.equal(eateryOrder.total, XEATERY1.flatMenu[ITEM_ID1].price);
  });

  it ('must return a correct total with a many items order', function () {
    const order = {
      id: 'someOrderId',
      eateryId: EATERY_ID1, 
      items: { [ITEM_ID1]: 1, [ITEM_ID2]: 2 },
    };
    const eateryOrder = makeEateryOrder(XEATERY1, order);
    const flatMenu = XEATERY1.flatMenu;
    const total = XITEM1.price + 2*XITEM2.price;
    assert.equal(eateryOrder.total, total);
  });

  it ('must return correct complete order for multi-item order', function () {
    const order = {
      id: 'someOrderId',
      eateryId: EATERY_ID1, 
      items: { [ITEM_ID1]: 1, [ITEM_ID2]: 2 },
    };
    const eateryOrder = makeEateryOrder(XEATERY1, order);
    const items = [
      { ...XITEM1, quantity: 1, quantityPrice: XITEM1.price },
      { ...XITEM2, quantity: 2, quantityPrice: 2*XITEM2.price },
    ];
    const total = XITEM1.price + 2*XITEM2.price;
    const expectedOrder = { ...order, ...EATERY1_ORDER_BASE, total, items };
    assert.deepEqual(eateryOrder, expectedOrder);
  });

  it ('must return BAD_REQ if eatery-id does not match eatery', function () {
    const order = { id: 'someOrderId', eateryId: EATERY_ID1 + 'xx' };
    const err = makeEateryOrder(XEATERY1, order);
    assert.equal(err.errors[0].code, 'BAD_REQ');
  });

  it ('must return a NOT_FOUND error if order has a bad item-id', function () {
    const order = {
      id: 'someOrderId',
      eateryId: EATERY_ID1, 
      items: { badItemId: 1,  },
    };
    const err = makeEateryOrder(XEATERY1, order);
    assert.equal(err.errors[0].code, 'NOT_FOUND');
  });


});	

function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}

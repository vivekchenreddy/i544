import request from 'supertest';
import Status from 'http-status';

import { setupDao, tearDownDao } from './util.mjs'
import params from '../src/params.mjs';
import WsServer from '../src/ws-server.mjs';
import xEatery from '../src/xeatery.mjs';

import fs from 'fs';

import chai from 'chai';
const { assert } = chai;

const COURSE_DIR = `${process.env.HOME}/cs544`;
const DATA_PATH = `${COURSE_DIR}/data/chow-down1.json`;
const DATA = readJson(DATA_PATH);

const EATERY_ID1 = '50_43';
const XEATERY1 = xEatery(DATA.find(eatery => eatery.id === EATERY_ID1));
const ITEM_ID1 = '254_13';
const XITEM1 = XEATERY1.flatMenu[ITEM_ID1]; 
const ITEM_ID2 = '243_68';
const XITEM2 = XEATERY1.flatMenu[ITEM_ID2]; 

const EATERY1_ORDER_BASE =
  Object.fromEntries(['name', 'loc', 'cuisine'].map(k => [k, XEATERY1[k]]));

describe ('orders web services', function() {

  let dao;
  let app;
  let server;

  beforeEach(async () => {
    dao = await setupDao();
    await dao.loadEateries(DATA);
    server = new WsServer(dao);
    app = server.app;
    await server.serve();
  });

  afterEach(async () => {
    await server.close();
    await tearDownDao(dao);
  });

  it ('must create a new order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	assert.equal(res.body.eateryId, EATERY_ID1);
	done();
      });
  });

  it ('must create a new order with proper links', function(done) {
    const createOrderUrl = `/orders?eateryId=${EATERY_ID1}`;
    request(app)
      .post(createOrderUrl)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	assert.equal(res.body.eateryId, EATERY_ID1);
	const linksInfo =
	  { self: createOrderUrl, order: orderId, eatery: EATERY_ID1 };
	const links = res.body.links;
	for (const [rel, suffix] of Object.entries(linksInfo)) {
	  const link = links.find(link => rel === link.rel);
	  assert.isDefined(link);
	  assert(link.href.endsWith(suffix),
		 `need suffix "${suffix}" on link.href "${link.href}"`);
	}
	done();
      });
  });

  it ('must create new orders with distinct id\'s', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const id1 = res.body.id;
	assert.isDefined(id1);
	request(app)
	  .post(`/orders?eateryId=${EATERY_ID1}`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.status, Status.CREATED);
	    const id2 = res.body.id;
	    assert.isDefined(id2);
	    assert.notEqual(id1, id2);
	    done();
	  });
      });
  });

  it('status NOT_FOUND when creating order with bad eatery-id', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1 + 'x'}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.NOT_FOUND);
	done();
      });
  });
  
  it ('must retrieve an existing order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .get(`/orders/${orderId}`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.body.id, orderId);
	    done();
	  });
      });
  });

  it ('must retrieve existing order with proper links', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	const getOrderUrl = `/orders/${orderId}`;
	request(app)
	  .get(getOrderUrl)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.body.id, orderId);
	    const linksInfo = { self: getOrderUrl, eatery: EATERY_ID1 };
	    const links = res.body.links;
	    for (const [rel, suffix] of Object.entries(linksInfo)) {
	      const link = links.find(link => rel === link.rel);
	      assert.isDefined(link);
	      assert(link.href.endsWith(suffix),
		     `need suffix "${suffix}" on link.href "${link.href}"`);
	    }
	    done();
	  });
      });
  });

  it ('status NOT_FOUND when retrieving bad order', function(done) {
    const orderId = 'BAD_ID';
    request(app)
      .get(`/orders/${orderId}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.NOT_FOUND);
	done();
      });
  });

  it ('must delete an existing order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .delete(`/orders/${orderId}`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.deepEqual(res.body, {});
	    done();
	  });
      });
  });

  it ('status NOT_FOUND when deleting bad order', function(done) {
    const orderId = 'BAD_ID';
    request(app)
      .delete(`/orders/${orderId}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.NOT_FOUND);
	done();
      });
  });


  it ('must add item to an existing order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId}?itemId=${ITEM_ID1}&nItems=1`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    const order = res.body;
	    assert.equal(order.items.length, 1);
	    assert.equal(order.total, XITEM1.price);
	    done();
	  });
      });
  });

  it ('must add multiple items to an existing order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId}?itemId=${ITEM_ID1}&nItems=2`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    const order1 = res.body;
	    assert.equal(order1.items.length, 1);
	    assert.equal(order1.total, 2*XITEM1.price);
	    request(app)
	      .patch(`/orders/${orderId}?itemId=${ITEM_ID2}&nItems=1`)
	      .set('Accept', 'application/json')
	      .expect('Content-Type', /json/)
	      .end(function (err, res) {
		const order2 = res.body;
		assert.equal(order2.items.length, 2);
		assert.equal(order2.total, 2*XITEM1.price + XITEM2.price);
		request(app)
		  .patch(`/orders/${orderId}?itemId=${ITEM_ID1}&nItems=1`)
		  .set('Accept', 'application/json')
		  .expect('Content-Type', /json/)
		  .end(function (err, res) {
		    const order3 = res.body;
		    assert.equal(order3.items.length, 2);
		    assert.equal(order3.total, XITEM1.price + XITEM2.price);
		    done();
		  });
	      });
	  });
      });
  });

  it ('must add item to an existing order with proper links', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	const getOrderUrl = `/orders/${orderId}`;
	request(app)
	  .patch(`${getOrderUrl}?itemId=${ITEM_ID1}&nItems=1`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    const order = res.body;
	    assert.equal(order.items.length, 1);
	    assert.equal(order.total, XITEM1.price);
	    const linksInfo = { self: getOrderUrl, eatery: EATERY_ID1 };
	    const links = res.body.links;
	    for (const [rel, suffix] of Object.entries(linksInfo)) {
	      const link = links.find(link => rel === link.rel);
	      assert.isDefined(link);
	      assert(link.href.endsWith(suffix),
		     `need suffix "${suffix}" on link.href "${link.href}"`);
	    }
	    done();
	  });
      });
  });

  it ('status NOT_FOUND when adding item to a bad order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId + 'x'}?itemId=${ITEM_ID1}&nItems=1`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.status, Status.NOT_FOUND);
	    done();
	  });
      });
  });

  it ('status NOT_FOUND when adding bad item to a order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId}?itemId=${ITEM_ID1 + 'x'}&nItems=1`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.status, Status.NOT_FOUND);
	    done();
	  });
      });
  });

  it ('status BAD_REQUEST when adding invalid nItems to order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId}?itemId=${ITEM_ID1}&nItems=-1`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.status, Status.BAD_REQUEST);
	    done();
	  });
      });
  });


  it ('must contain complete multiple items order', function(done) {
    request(app)
      .post(`/orders?eateryId=${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.CREATED);
	const orderId = res.body.id;
	assert(typeof orderId === 'string' && orderId.trim().length > 0);
	request(app)
	  .patch(`/orders/${orderId}?itemId=${ITEM_ID1}&nItems=2`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    const order1 = res.body;
	    assert.equal(order1.items.length, 1);
	    assert.equal(order1.total, 2*XITEM1.price);
	    request(app)
	      .patch(`/orders/${orderId}?itemId=${ITEM_ID2}&nItems=1`)
	      .set('Accept', 'application/json')
	      .expect('Content-Type', /json/)
	      .end(function (err, res) {
		const order2 = { ... res.body };
		delete order2.links;
		const expectedOrder = {
		  id: orderId,
		  eateryId: EATERY_ID1,
		  ...EATERY1_ORDER_BASE,
		  items: [
		    { ...XITEM1, quantity: 2, quantityPrice: 2*XITEM1.price },
		    { ...XITEM2, quantity: 1, quantityPrice: XITEM2.price },
		  ],
		  total: 2*XITEM1.price + XITEM2.price,
		};
		assert.deepEqual(order2, expectedOrder);
		done();
	      });
	  });
      });
  });

});	
  
function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}

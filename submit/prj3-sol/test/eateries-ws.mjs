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

describe ('eateries web services', function() {

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

  it ('must find a particular eatery', function(done) {
    request(app)
      .get(`/eateries/${EATERY_ID1}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	const eatery = { ...res.body };
	delete eatery.links;
	assert.deepEqual(eatery, XEATERY1);
	done();
      });
  });

  it ('must not find an eatery with unknown id', function(done) {
    request(app)
      .get(`/eateries/${EATERY_ID1 + 'x'}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.deepEqual(res.status, Status.NOT_FOUND);
	done();
      });
  });

  it ('must find all chinese eateries', function(done) {
    const { lat, lng } = params.bingLoc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=999`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.body.eateries?.length, 19);
	done();
      });
  });
 
  it ('must find eatery at specified location', function(done) {
    const { lat, lng } = XEATERY1.loc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.deepEqual(res.body.eateries[0].id, EATERY_ID1);
	assert.equal(res.body.eateries[0].dist, 0);
	done();
      });
  });
 
  it ('must find eatery at specified offset', function(done) {
    const { lat, lng } = XEATERY1.loc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=5`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	const id2 = res.body.eateries[2].id;
	request(app)
	  .get(`/eateries/${lat},${lng}?cuisine=chinese&count=5&offset=2`)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.body.eateries[0].id, id2);
	    done();
	  });
      });
  });
 
  it ('use links to page forward thru eateries', function(done) {
    const { lat, lng } = XEATERY1.loc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=10`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	const absNext = res.body.links.find(lnk => lnk.rel === 'next').href;
	const next = relUrl(absNext);
	assert.equal(res.body.eateries?.length, 10);
	request(app)
	  .get(next)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.body.eateries?.length, 9);
	    done();
	  });
      });
  });
 
  it ('use links to page backward and forward thru eateries', function(done) {
    const { lat, lng } = XEATERY1.loc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=10`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	const id0 = res.body.eateries[0].id;
	const absNext = res.body.links.find(lnk => lnk.rel === 'next').href;
	const next = relUrl(absNext);
	assert.equal(res.body.eateries?.length, 10);
	request(app)
	  .get(next)
	  .set('Accept', 'application/json')
	  .expect('Content-Type', /json/)
	  .end(function (err, res) {
	    assert.equal(res.body.eateries?.length, 9);
	    const absPrev = res.body.links.find(lnk => lnk.rel === 'prev').href;
	    const prev = relUrl(absPrev);
	    request(app)
	      .get(prev)
	      .set('Accept', 'application/json')
	      .expect('Content-Type', /json/)
	      .end(function (err, res) {
		assert.equal(res.body.eateries?.length, 10);
		assert.equal(res.body.eateries[0].id, id0);
		done();
	      });
	  });
      });
  });
 
  it ('each eatery summary must contain self link for details', function(done) {
    const { lat, lng } = XEATERY1.loc;
    request(app)
      .get(`/eateries/${lat},${lng}?cuisine=chinese&count=10`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	const eateries = res.body.eateries;
	assert.equal(eateries.length, 10);
	for (const eatery of eateries) {
	  const links = eatery.links;
	  assert.isDefined(links);
	  const self = links[0];
	  assert.equal(self.rel, 'self');
	  assert(self.href.endsWith(eatery.id));
	}
	done();
      });
  });
  
  it ('must return status BAD_REQUEST for no cuisine', function(done) {
    const { lat, lng } = params.bingLoc;
    request(app)
      .get(`/eateries/${lat},${lng}?count=999`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.BAD_REQUEST);
	done();
      });
  });

  it ('must return status BAD_REQUEST for bad latitude', function(done) {
    const { lat, lng } = params.bingLoc;
    request(app)
      .get(`/eateries/${lat + 'x'},${lng}?cuisine=chinese&count=999`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.BAD_REQUEST);
	done();
      });
  });

  it ('status BAD_REQUEST for out-of-range longitude', function(done) {
    const { lat, lng } = params.bingLoc;
    request(app)
      .get(`/eateries/${lat},${lng + 400}?cuisine=chinese&count=999`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .end(function (err, res) {
	assert.equal(res.status, Status.BAD_REQUEST);
	done();
      });
  });

});	
  
function readJson(path) {
  const text = fs.readFileSync(path, 'utf8');
  return JSON.parse(text);
}

function relUrl(absUrl) {
  const url = new URL(absUrl);
  return `${url.pathname}${url.search}`;
}

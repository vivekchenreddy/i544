import cors from 'cors';
import express from 'express';
import assert from 'assert';
import bodyParser from 'body-parser';
import querystring from 'querystring';
import Status from 'http-status';  //Status.OK, Status.NOT_FOUND, etc.

import fs from 'fs';
import http from 'http';
import https from 'https';

import params from './params.mjs';
import { AppError } from './util.mjs';

//eateryOrder(eatery, order): returns order augmented with eatery info
//validates that eatery.id === order.eateryId and each item in
//order corresponds to an item in eatery.  See eatery-order.mjs
//for further details.
import eateryOrder from './eatery-order.mjs';

/*************************** Exported Class ****************************/

export default class WsServer {
  constructor(dao, config={}) {
    const app = this.app = express();
    this._config = config;
    app.locals.base = config.wsParams?.base ?? '';
    app.locals.dao = dao;
    setupRoutes(app);
  }

  async serve() {
    const { cert, ca, key } = this._readCerts();
    const doHttps = cert && key;
    const type = doHttps ? 'HTTPS' : 'HTTP';
    const server = doHttps
        ? https.createServer({cert, ca, key}, this.app)
        : http.createServer(this.app);
    this._server = await new Promise(resolve => {
      server.listen(this._config.ws?.port ?? 0, function()  {
        resolve(this);
      });
    });
    const port = this.app.locals.port = this._server.address().port;
    return { port, type };
  }

  close(fn) { this._server.close(fn); }

  _readCerts() {
    try {
      const httpsPaths = this._config.https;
      const cert = httpsPaths?.certPath &&
          fs.readFileSync(httpsPaths.certPath, 'utf8');
      const ca =
          httpsPaths?.certPath && fs.readFileSync(httpsPaths.caPath, 'utf8');
      const key =
          httpsPaths?.keyPath && fs.readFileSync(httpsPaths.keyPath, 'utf8');
      return { cert, ca, key };
    }
    catch (err) {
      if (!err.message.startsWith('ENOENT')) throw err;
    }
    return {};
  }

} //class WsServer

/******************************** Routes *******************************/

function setupRoutes(app) {
  const base = app.locals.base;
  app.use(cors());
  app.use(bodyParser.json());
  app.get(`${base}/eateries/:lat,:lng`, locateEateries(app));
  app.get(`${base}/eateries/:eateryId`, getEatery(app));


  app.post(`${base}/orders`,newOrder(app))
  app.get(`${base}/orders/:orderId`,getOrder(app))
  app.patch(`${base}/orders/:orderId`,updateOrder(app))
  app.delete(`${base}/orders/:orderId`,removeOrder(app))




  //must be last
  app.use(do404(app));
  app.use(doErrors(app));
}


/************************* Order Handlers ******************************/

/* Suggested structure for setting up a handler

function handler(app) {
  return (async function(req, res) {
    try {
      ...
      if (someResult.errors) throw someResult;
      ...
      res.status(...) ... res.json(...)
    }
    catch(err) {
      //console.log(err); //uncomment during devel, especially for running tests
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}
*/

// All response data is sent using JSON.

/** HATEOAS Links
 *  Almost all response objects have a top-level links property
 *  which should be a list of link objects.  Each link object
 *  has rel and name properties (with identical values) and
 *  href which is an absolute URL linking to the referenced
 *  entity.  The API provides the following kinds of link
 *  objects:
 *
 *  Self Link: { rel: 'self', name: 'self', href: ... }
 *  with href giving the URL for which this response is being
 *  generated.
 *
 *  Eatery Link: { rel: 'eatery', name: 'eatery', href: ... }
 *  with href giving a link to the relevant eatery.
 *
 *  Order Link: { rel: 'order', name: 'order', href: ... }
 *  with href giving a link to the relevant order.
 *
 *  Note that the utility functions provided at the end of
 *  this file will help generating these links.
 */

/** Return handler for POST /orders?eateryId=EATERY_ID: Create and return a
 *  new eatery-order for eatery specified by query parameter eateryId.
 *  Return status 201 Created, with Location header set to url of
 *  newly created order.
 *
 *  Links: self, order, eatery.
 *
 *  Errors:
 *     BAD_REQUEST if missing eateryId; NOT_FOUND if no eatery
 *     for eateryId. *
 */
function newOrder(app) {
  return (async function(req, res) {
    try {
      const Ideatery = req.query.eateryId;
      const query = eateryQuery(req.query);
      if (Ideatery.errors || query.errors) {
        throw { errors: (Ideatery.errors ?? []).concat(query.errors ?? []) };
      }
      const links =  [ selfLink(req), ];
      const result = await app.locals.dao.newOrder(Ideatery);
      const eatery = await app.locals.dao.getEatery(Ideatery);
      if (eatery.errors) throw eatery;
      links.push(eateryLink(req,Ideatery),)

      let eateryOrderObject;
      eateryOrderObject=eateryOrder(eatery,result)
      if (result.errors) throw result;
      links.push(  orderLink(req,result.id), )
      eateryOrderObject["links"]=links
      res.status(Status.CREATED).send(eateryOrderObject)

    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Return handler for GET /orders/ORDER_ID: Return eatery-order with
 *  id ORDER_ID.
 *
 *  Links: self, eatery.
 *
 *  Errors: NOT_FOUND if bad ORDER_ID or no eatery for order's eatery-id.
 */
function getOrder(app) {
  return (async function (req, res) {
    try {
      const orderId = req.params.orderId;
      const result = await app.locals.dao.getOrder(orderId);
      const Ideatery = result["eateryId"]
      const eatery = await app.locals.dao.getEatery(Ideatery);
      const links = [selfLink(req),];
      if (result.errors) throw result;
      links.push(eateryLink(req, Ideatery),)

      let eateryOrderObject;
      eateryOrderObject = eateryOrder(eatery, result)

      eateryOrderObject["links"] = links
      res.status(Status.CREATED).send(eateryOrderObject)
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }

  });
}
/** Return handler for DELETE /orders/ORDER_ID: Remove order with id
 *  ORDER_ID.
 *
 *  Success Return: {}
 *
 *  Errors: NOT_FOUND if bad ORDER_ID.
 */
function removeOrder(app) {
  return (async function(req, res) {
    try {
      const orderId = req.params.orderId;
      const result = await app.locals.dao.removeOrder(orderId);
      const result1 = await app.locals.dao.getOrder(orderId);
      if (result.errors) {
        res.status(Status.NOT_FOUND).json(result1);
      } else {
        res.status(Status.CREATED).json({})
      }
    }catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }

  });
}

/** Return handler for PATCH /orders/ORDER_ID?itemId=ITEM_ID&nItems=N_ITEMS:
 *  Update order with id ORDER_ID; set order to contains N_ITEMS units
 *  of item ITEM_ID.
 *
 *  Links: self-link to order URL; eatery link.
 *
 *  Errors: BAD_REQUEST if missing ITEM_ID, or invalid N_ITEMS.
 *  NOT_FOUND if invalid ORDER_ID, invalid eateryId associated
 *  with order, or no item ITEM_ID in eatery specified by order's
 *  eateryId.
 *
 */
function updateOrder(app) {
  return (async function(req, res) {
    try {
      let result={};
      const orderId = req.params.orderId;
      const itemId = req.query.itemId;
      const nItems = req.query.nItems;
      const validity=itemsValidator(req.query,orderId)
      if(validity.errors)throw validity;
      result = await app.locals.dao.editOrder(orderId, itemId, parseInt(nItems));

      if (result.errors) throw result;
      const Ideatery = result["eateryId"]
      const eatery = await app.locals.dao.getEatery(Ideatery);
      req.originalUrl=`/orders/${orderId}`
      const links = [selfLink(req),];
      links.push(eateryLink(req, Ideatery),)
      let eateryOrderObject;
      eateryOrderObject = eateryOrder(eatery, result)
      if(eateryOrderObject.errors){
        const a=await app.locals.dao.editOrder(orderId, itemId, 0);
        throw eateryOrderObject;
      }
      eateryOrderObject["links"]=links

      res.status(Status.CREATED).send(eateryOrderObject)

    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function itemsValidator(query,Id) {
  const { itemId,nItems, offset='0', count=String(params.defaultCount) } = query
  const errors = [];
  if (itemId  === undefined) {
    errors.push(new AppError(`no itemId in update for order "${Id}"`, {code: 'BAD_REQ'}));
  }
  else if (nItems===undefined) {
    errors.push(new AppError(`bad nItems undefined in update for order "${Id}"`, {code: 'BAD_REQ'}));
  }

  return (errors.length > 0)
      ? { errors }
      : { itemId, offset: Number(offset), count: Number(count) };
}

/************************** Eatery Handlers ****************************/

function getEatery(app) {
  return (async function(req, res) {
    try {
      const eateryId = req.params.eateryId;
      const result = await app.locals.dao.getEatery(eateryId);
      if (result.errors) throw result;
      const ret = { links: [ selfLink(req) ], ...result };
      res.json(ret);
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function locateEateries(app) {
  return (async function(req, res) {
    try {
      const {lat, lng} = req.params;
      const loc = location({lat, lng});
      const query = locateQuery(req.query);
      if (loc.errors || query.errors) {
        throw { errors: (loc.errors ?? []).concat(query.errors ?? []) };
      }
      const { cuisine, offset, count } = query;
      const count1 = count + 1;
      const results =
          await app.locals.dao.locateEateries(cuisine, loc, offset, count1);
      if (results.errors) throw results;
      const links =  [ selfLink(req), ];
      if (results.length > count) {
        const qNext = Object.assign({}, query, { offset: offset + count });
        const next = `${selfUrl(req, false)}?` + querystring.stringify(qNext);
        links.push({ rel: 'next', name: 'next', href: next });
      }
      if (offset !== 0 && results.length > 0) {
        const prevOffset = offset > count ? offset - count : 0;
        const qPrev = Object.assign({}, query, { offset: prevOffset });
        const prev = `${selfUrl(req, false)}?` + querystring.stringify(qPrev);
        links.push({ rel: 'prev', name: 'prev', href: prev });
      }
      const eateries = results.slice(0, count).map(function (e) {
        const self = { rel: 'self', name: 'self', href: eateryUrl(req, e.id) };
        return { links: [ self ], ...e };
      });
      res.json({ eateries, links });
    }
    catch(err) {
      //console.log(err); //uncomment during devel, especially for running tests
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

const LOC_INFOS = {
  lat: {
    name: 'latitude',
    range: [-90, 90],
  },
  lng: {
    name: 'longitude',
    range: [-180, 180],
  },
};

function location(locStrings) {
  const errors = [];
  const loc = {};
  for (const [k, v] of Object.entries(locStrings)) {
    const info = LOC_INFOS[k];
    if (!/^[-+]?\d+(?:\.\d*)?$/.test(v)) {
      errors.push(new AppError(`bad ${info.name} "${v}"`, {code: 'BAD_REQ'}));
    }
    else {
      const num = loc[k] = Number(v);
      if (num < info.range[0] || num > info.range[1]) {
        const msg = `${info.name} ${num} not in range [${info.range}]`;
        errors.push(new AppError(msg, {code: 'BAD_REQ'}));
      }
    }
  }
  return (errors.length > 0) ? { errors } : loc;
}

function locateQuery(query) {
  const { cuisine, offset='0', count=String(params.defaultCount) } = query
  const errors = [];
  if ((cuisine ?? '').trim().length === 0) {
    errors.push(new AppError('missing cuisine parameter', {code: 'BAD_REQ'}));
  }
  if (!/^\d+$/.test(offset)) {
    errors.push(new AppError('bad offset "${offset}"', {code: 'BAD_REQ'}));
  }
  if (!/^\d+$/.test(count)) {
    errors.push(new AppError('bad count "${count}"', {code: 'BAD_REQ'}));
  }
  return (errors.length > 0)
      ? { errors }
      : { cuisine, offset: Number(offset), count: Number(count) };
}

function eateryQuery(query) {
  const { eateryId, offset='0', count=String(params.defaultCount) } = query
  const errors = [];
  if ((eateryId ?? '').trim().length === 0) {
    errors.push(new AppError('missing eatery parameter', {code: 'BAD_REQ'}));
  }

  return (errors.length > 0)
      ? { errors }
      : { eateryId, offset: Number(offset), count: Number(count) };
}

/*************************** Error Handlers ****************************/

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: Status.NOT_FOUND,
      errors: [	{ options: { code: 'NOT_FOUND' }, message, }, ],
    };
    res.status(Status.NOT_FOUND).json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */
function doErrors(app) {
  return async function(err, req, res, next) {
    const message = err.message ?? err.toString();
    const result = {
      status: Status.INTERNAL_SERVER_ERROR,
      errors: [ { options: { code: 'INTERNAL' }, message } ],
    };
    res.status(Status.INTERNAL_SERVER_ERROR).json(result);
    console.error(result.errors);
  };
}

/*************************** Mapping Errors ****************************/

//map from domain errors to HTTP status codes.  If not mentioned in
//this map, an unknown error will have HTTP status BAD_REQUEST.
const ERROR_MAP = {
  EXISTS: Status.CONFLICT,
  NOT_FOUND: Status.NOT_FOUND,
  DB: Status.INTERNAL_SERVER_ERROR,
  INTERNAL: Status.INTERNAL_SERVER_ERROR,
}

/** Return first status corresponding to first option.code in
 *  appErrors, but INTERNAL_SERVER_ERROR dominates other statuses.
 *  Returns BAD_REQUEST if no code found.
 */
function getHttpStatus(appErrors) {
  let status = null;
  for (const appError of appErrors) {
    const errStatus = ERROR_MAP[appError.options?.code];
    if (!status) status = errStatus;
    if (errStatus === Status.INTERNAL_SERVER_ERROR) status = errStatus;
  }
  return status ?? Status.BAD_REQUEST;
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapResultErrors(err) {
  const errs = err.errors ?? [ new AppError(err.message ?? err.toString()) ];
  const errors =
      errs.map(err => ({message: err.message, options: err.options}));
  const status = getHttpStatus(errors);
  if (status === Status.INTERNAL_SERVER_ERROR) console.error(errors);
  return { status, errors, };
}

/***************************** Utilities *******************************/

/** Return self url for req; include query-params if isQuery. */
function selfUrl(req, isQuery=true) {
  const port = req.app.locals.port;
  const originalUrl =
      isQuery ? req.originalUrl : req.originalUrl.replace(/\?.*/, '');
  return `${req.protocol}://${req.hostname}:${port}${originalUrl}`;
}

/** Return url for eatery eateryId based on req */
function eateryUrl(req, eateryId) {
  return selfUrl(req).replace(req.originalUrl, `/eateries/${eateryId}`);
}

/** Return url for order orderId based on req */
function orderUrl(req, orderId) {
  return selfUrl(req).replace(req.originalUrl, `/orders/${orderId}`);
}

function selfLink(req) {
  return {
    rel: 'self',
    name: 'self',
    href: selfUrl(req),
  };
}

function eateryLink(req, eateryId) {
  return {
    rel: 'eatery',
    name: 'eatery',
    href: eateryUrl(req, eateryId),
  };
}

function orderLink(req, orderId) {
  return {
    rel: 'order',
    name: 'order',
    href: orderUrl(req, orderId),
  };
}

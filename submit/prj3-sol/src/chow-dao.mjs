import { AppError,} from './util.mjs';
import xEatery from './xeatery.mjs';
import params from './params.mjs';

import mongo from 'mongodb';

//use in mongo.connect() to avoid warning
const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

const EATERIES_COLLECTION = 'eateries';
const ORDERS_COLLECTION = 'orders';

// properties which are used only within mongo documents and should be
// removed from returned objects.
const INTERNALS = [ '_id', '_cuisine', '_location' ];

/** Exported factory method. */
export default async function make(dbUrl) {
  return await ChowDao.make(dbUrl);
}

/**
 * In addition to the docs for each method, each method is subject to
 * the following additional requirements:
 *
 *   + All string matching is case-insensitive.  Hence specifying
 *     cuisine "american" or "American" for locate() should return
 *     a list of all eateries having American cuisine.
 *
 *   + The implementation of each of the required methods should not
 *     require searching.  Instead, the database should set up
 *     suitable data structure which allow returning the requested
 *     information without searching.
 *  
 *   + Errors are returned by returning an object with property
 *     _errors which must be a list of objects, each having 
 *     message and code properties.
 *
 *   + Any otherwise uncategorized database error should be returned
 *     with code 'DB'.
 */
class ChowDao {

  constructor(params) {  Object.assign(this, params); }

  //factory method which performs connection set up async calls
  //and all other necessary initialization, sets up properties
  //to be stored in the ChowDao instance and finally returns
  //the instance created using the properties.
  //Returns object containsing an errors property if a db errors.
  static async make(dbUrl) {
    const params = {};
    try {
      params._client = await mongo.connect(dbUrl, MONGO_CONNECT_OPTIONS);
      const db = params._client.db();
      params._eateries = db.collection(EATERIES_COLLECTION);
      params._orders = db.collection(ORDERS_COLLECTION);
      const nextIdBase =
        (await params._orders.findOne({_id: NEXT_ID_KEY}))?.[NEXT_ID_KEY] ?? 0;
      params._idGen = new IdGen(nextIdBase);
    }
    catch (err) {
      const msg = `cannot connect to URL "${dbUrl}": ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
    return new ChowDao(params);
  }

  /** Release all resources held by this instance.
   *  Specifically, close any database connections.
   */
  async close() {
    await this._client.close();
  }

  /** Return a new order object { id, eateryId } having an id
   *  field set to an ID different from that of any existing order.
   *  The order-id should be hard to guess.
   *  Returns an object with errors property if db errors encountered.
   */ 
  async newOrder(eateryId) {
    try {
      const id = await this._nextOrderId();
      if (id.errors) return id;
      const order = { id, eateryId, items: {},  };
      const dbOrder = { _id: id, ...order };
      const nIns = (await this._orders.insertOne(dbOrder))?.insertedCount;
      if (nIns !== 1) {
	const msg = `order create: expected 1 insert, got ${nMod} updates`;
	return { errors: [ new AppError(msg, { code: 'DB'}) ] };
      }
      return order;
    }
    catch (err) {
      const msg = `cannot create new order: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  // Returns a unique, difficult to guess order-id.
  async _nextOrderId() {
    const id = this._idGen.nextId();
    const nextBase = this._idGen.base;
    const idKey = { _id: NEXT_ID_KEY };
    const doc = { _id: NEXT_ID_KEY, [NEXT_ID_KEY]: nextBase };
    const opts = { upsert: true };
    const replace = await this._orders.replaceOne(idKey, doc, opts);
    const { modifiedCount: nMod, upsertedId } = replace ?? {};
    if (nMod !== 1 && !upsertedId) {
      const msg = `next id inc: got ${nMod} updates without upsertId`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
    return id;
  }

  /** Return object { id, eateryId, items? } containing details for
   *  order identified by orderId.  The returned items should be an object
   *  mapping an item-id to the positive quantity for that item.  
   *
   *  If there is no order having orderId, then return a NOT_FOUND error.
   */
  async getOrder(orderId) {
    try {
      const dbOrder = await this._orders.findOne({ _id: orderId });
      if (!dbOrder) {
	const msg = `no order with orderId ${orderId}`;
	return { errors: [ new AppError(msg, { code: 'NOT_FOUND'}) ] };
      }
      else {
	const order = { ...dbOrder };
	delete order._id;
	return order;
      }
    }
    catch (err) {
      const msg = `cannot read order ${orderId}: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** Remove order identified by orderId from db.  Returns {} if ok,
   *  NOT_FOUND error if there is no order having id orderId.
   */
  async removeOrder(orderId) {
    try {
      const idKey = { _id: orderId };
      const delCount = (await this._orders.deleteOne(idKey))?.deletedCount;
      if (delCount !== 1) {
	const msg = `got ${delCount} deletions`;
	return { errors: [ new AppError(msg, { code: 'NOT_FOUND'}) ] };
      }
      return {};
    }
    catch (err) {
      const msg = `cannot read order ${orderId}: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** Change quantity for itemId in order orderId to nItems.  Return
   *  updated order.
   *
   *  Return error NOT_FOUND if there is no order for orderId.
   */
  async editOrder(orderId, itemId, nItems) {
    try {
      const order = await this.getOrder(orderId);
      if (order.errors) return order;
      if (nItems < 0) {
	const msg = `cannot have a negative quantity ${nItems}`;
	return { errors: [ new AppError(msg, { code: 'BAD_REQ'}) ] };
      }
      const edited = { ...order, _id: orderId, items: { ...order.items }, };
      edited.items ??= {};
      if (nItems === 0) {
	delete edited.items[itemId];
      }
      else {
	edited.items[itemId] = nItems;
      }
      if (order.items?.[itemId] !== nItems) {
	const idKey = { _id: orderId };
	const nMod =
	  (await this._orders.replaceOne(idKey, edited))?.modifiedCount;
	if (nMod !== 1) {
	  const msg = `order item edit: got ${nMod} replacements; expected 1`;
	  return { errors: [ new AppError(msg, { code: 'DB'}) ] };
	}
      }
      delete edited._id;
      return edited;
    }
    catch (err) {
      const msg = `cannot edit order ${orderId}: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** Clear out all orders */
  async clearOrders() {
    try {
      await this._orders.deleteMany({});
      this._idGen.reset();
      return {};
    }
    catch (err) {
      const msg = `cannot clear orders: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** Return eatery having specified id eid.  Return errors if eid is
   *  invalid with error object having code property 'NOT_FOUND'.
   */
  async getEatery(eid) {
    try {
      const eatery = await
        this._eateries.findOne({ _id: eid.replaceAll('.', '_') });
      if (eatery === null) {
	const msg = `cannot find eatery "${eid}"`;
	return { errors: [ new AppError(msg, { code: 'NOT_FOUND'}) ] };
      }
      const ret = { ...eatery };
      INTERNALS.forEach(i => delete ret[i]);
      return ret;
    }
    catch (err) {
      const msg = `cannot find eatery "${eid}": ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** Replace all existing eateries in underlying database with eateries. */
  async loadEateries(eateries) {
    try {
      await this._eateries.deleteMany({});
      await this._eateries.createIndex({_cuisine: 'hashed'});
      await this._eateries.createIndex({_location: '2dsphere'});
      for (const eatery of eateries) {
	const insert = {
	  ...xEatery(eatery),
	  _id: eatery.id.replaceAll('.', '_'),
	  _cuisine: eatery.cuisine.toLowerCase(),
	  _location: {
	    type: 'Point',
	    coordinates: [ eatery.loc.lng, eatery.loc.lat ],
	  },
	};
	const ret = await this._eateries.insertOne(insert);
	if (ret.insertedCount !== 1) {
	  throw `inserted ${ret.insertedCount} eateries for ${eatery.id}`;
	}
      } //for
      return {};
    }
    catch (err) {
      const msg = `cannot load eateries: ${err}`;
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

  /** return list giving info for eateries having the
   *  specified cuisine.
   *  The info returned for each eatery must contain the
   *  following fields: 
   *     id: the eatery ID.
   *     name: the eatery name.
   *     loc: { lat, lng } object giving location of eatery,
   *     dist: the distance of the eatery from loc
   *  The returned list must be sorted by dist from 
   *  loc { lat, lng }.  Return [] if there are no eateries for the 
   *  specified cuisine.
   */
  async locateEateries(cuisine, loc=params.bingLoc, offset=0,
		       count=params.defaultCount)
  {
    try {
      const params = [{
	$geoNear: {
	  near: { type: 'Point', coordinates: [ loc.lng, loc.lat ] },
	  spherical: true,
	  query: { _cuisine: cuisine.toLowerCase(), },
	  distanceField: 'dist',
	  distanceMultiplier: 1/1600,
	},
      }];
      const cursor = await
        this._eateries.aggregate(params).skip(offset).limit(count);
      const arr = await cursor.toArray();
      return arr.map(a => ({
	id: a.id,
	name: a.name,
	loc: a.loc,
	dist: a.dist,
	cusine: a.cuisine,
      }));
    }
    catch (err) {
      const msg = `
	cannot locate "${cuisine} eateries at (${loc.lat}, ${loc.lng}): ${err}
      `.trim();
      return { errors: [ new AppError(msg, { code: 'DB'}) ] };
    }
  }

}

const NEXT_ID_KEY = 'nextIdBase';

/** Generate id strings.  Construct by passing an integer base which
 *  will be used to generate the base part of an id as "baseInc_rand"
 *  where baseInc is an increment of base and rand is a random number.
 *  baseInc will make the id unique and rand will make the id
 *  difficult to guess.
 *
 *  Exposes a base property giving the current value of base.
 */
const ID_RAND_LEN = 2;  //increase for production code
class IdGen {
  constructor(base) { this._base = base; }

  nextId() {
    return (this._base++ + Math.random())
      .toFixed(ID_RAND_LEN)
      .replace('.', '_');
  }

  get base() { return this._base; }
  reset() { this._base = 0; }
  
}


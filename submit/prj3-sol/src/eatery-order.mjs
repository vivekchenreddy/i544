import { AppError } from './util.mjs';

/** Returns order enhanced with details pulled from xEatery.
 *
 *  Specifically, returned order has same top-level fields (except
 *  items) as order + xEatery's name, loc and cuisine fields + a total
 *  field which is the total price of the order.  
 *
 *  Additionally, the returned order must have an items field which is
 *  a list of objects, one object for each [itemId, quantity] entry in
 *  order.items.  Each item object should contain all the fields of
 *  xEatery.flatMenu[itemId] + quantity + quantityPrice which is the
 *  price of the item multiplied by the quantity.
 *
 *  Returns BAD_REQ errors if order.eateryId does not match xEatery.
 *  Returns NOT_FOUND if there is an item in order which does not
 *  correspond to a menu-item in xEatery.
 */
export default function(eatery, order) {
  return new EateryOrder(eatery, order);
}

class EateryOrder {
  constructor(xEatery, order) {
    const validation = validate(xEatery, order);
    if (validation.errors) return validation;
    const itemPairs = Object.entries(order.items ?? []);
    const items = itemPairs.map(([k, v]) => ({
      ...xEatery.flatMenu[k], 
      quantity: v,
      quantityPrice: v * xEatery.flatMenu[k].price,
    }));
    const total = items.reduce((acc, item) => acc + item.quantityPrice, 0);
    Object.assign(this, {
      ...order,
      name: xEatery.name,
      loc: xEatery.loc,
      cuisine: xEatery.cuisine,
      items, total
    });
  }
}

function validate(xEatery, order) {
  if (order.eateryId !== xEatery.id) { //this represents an internal error
    const msg =
      `order eateryId "${order.eateryId}" does not match that ` +
      `of provided eatery "${xEatery.id}"`;
    return { errors: [ new AppError(msg, { code: 'BAD_REQ' }) ] };
  }
  const errors = [];
  for (const itemId of Object.keys(order.items ?? [])) {
    if (xEatery.flatMenu[itemId] === undefined) {
      const msg = `unknown item-id "${itemId}" in order "${order.id}"`;
      errors.push(new AppError(msg, { code: 'NOT_FOUND' }));
    }
  }
  return errors.length > 0 ? { errors } : {};
}

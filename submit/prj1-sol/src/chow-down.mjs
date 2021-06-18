import { AppError } from './util.mjs';

/**
 * In addition to the docs for each method, each method is subject to
 * the following additional requirements:
 *
 *   + All string matching is case-insensitive.  Hence specifying
 *     cuisine "american" or "American" for locate() should return
 *     a list of all eateries having American cuisine.
 *
 *   + The implementation of each of the required methods should not
 *     require searching.  Instead, the returned object instance
 *     should set up suitable data structure which allow returning the
 *     requested information without searching.
 *  
 *   + Errors are returned by returning an object with property
 *     _errors which must be a list of objects, each having a 
 *     message property.
 */
class ChowDown {

  /** Create a new ChowDown object for specified eateries */
  constructor(eateries) {
    this.eateries = eateries;
  }

  /** return list giving info for eateries having the
   *  specified cuisine.  The info for each eatery must contain the
   *  following fields:
   *     id: the eatery ID.
   *     name: the eatery name.
   *     dist: the distance of the eatery.
   *  The returned list must be sorted by distance.  Return [] if
   *  there are no eateries for the specified cuisine.
   */
  locate(cuisine) {
    let i=0;
    const data = [];
    const eateryLength = this.eateries.length
    while (i < eateryLength){
      if (this.eateries[i]['cuisine'].toLowerCase() === cuisine.toLowerCase()) {
        const filteredEatery = {
          "id": this.eateries[i].id,
          "name": this.eateries[i].name,
          "dist": this.eateries[i].dist
        };
        data.push(filteredEatery);
      }
      i++;
    }
    data.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
    return data;
  }

  /** return list of menu categories for eatery having ID eid.  Return
   *  errors if eid is invalid with error object having code property
   *  'NOT_FOUND'.
   */
  categories(eid) {
    let i=0;
    const keys = [];
    while(i<this.eateries.length){
      if (this.eateries[i]['id'] === eid) {
        Object.keys(this.eateries[i].menu).forEach(function(key) {
          keys.push(key)
        });
      }
      i++;
    }
    if(keys.length===0){
      const msg = `bad eatery id ${eid}`;
      return { _errors: [ new AppError(msg, { code: 'NOT_FOUND', }), ] };
    }else {
      return keys;
    }
  }

  /** return list of menu-items for eatery eid in the specified
   *  category.  Return errors if eid or category are invalid
   *  with error object having code properVpDcbYKty 'NOT_FOUND'.
   */
  menu(eid, category) {
    let i=0;
    const data=[];
    let printCategory=""
    while (i < this.eateries.length) {
      if (this.eateries[i]['id'] === eid) {
        for (const k in this.eateries[i].menu)
        {
          if(k.toLowerCase()===category.toLowerCase()){
            printCategory=k
            data.push(this.eateries[i].menu[k]);
          }
        }
      }
      i++
      }
    if(data.length===0) {
      const msg = `bad category ${category}`;
      return {_errors: [new AppError(msg, {code: 'NOT_FOUND',}),]};
    }
    console.log("menu" + " [ "+"\'"+eid.toString()+"\'"+"\, "+"\'"+printCategory+"\'"+" ] ")
    return data[0];
    }

}
export default function make(eateries) {
  return new ChowDown(eateries);
}

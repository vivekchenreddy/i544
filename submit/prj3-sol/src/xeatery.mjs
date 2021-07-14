/** Return an extended eatery object which is eatery enhanced with
 *  two additional properties:
 *    menuCategories: a list of all menu categories (Object.keys(menu)
 *    flatMenu: a map from a menu itemId to the menu item info enhanced
 *              with the item category.
 *    menu: map from category to list of categoryId
 */
export default function xEatery(eatery) {
  const menuCategories = Object.keys(eatery.menu);
  const menuEntries = Object.entries(eatery.menu);
  const itemPairs =
    menuEntries.flatMap(([category, items]) => xItemPairs(category, items));
  const flatMenu = Object.fromEntries(itemPairs);
  const categoryItemIdsPairs =
    menuEntries.map(([c, items]) => [c, items.map(item => item.id)]);
  const menu = Object.fromEntries(categoryItemIdsPairs);
  return { ...eatery, menuCategories, flatMenu, menu };
}

function xItemPairs(category, items) {
  return items.map(item => [item.id, { ...item, category }]);
}

  

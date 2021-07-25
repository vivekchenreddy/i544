import { newElement, geoLoc } from './util.mjs';

/*
  A component which searches for eateries by location and cuisine.
  The location must be set to the browser's location (from geoLoc()).

  This component has two attributes:

    ws-url:  the base URL (protocol, host, port) where the web
             services are located.
    cuisine: the cuisine to be searched for.

  This component does not do anything when first connected to the DOM.
  It must respond to changes in its attribute values:

    ws-url: when this attribute changes, the component simply remembers
    its value.

    cuisine: when changed, the component should make a web-service call
    to search for eateries for that cuisine with location set to the 
    browser's location.  Then it should set it's content corresponding
    to the pseudo-HTML shown below (dynamic data is shown within ${...} and
    wsData is the data returned from the web-service call):

      <ul class="eatery-results">
	<!-- repeat for each eatery in wsData.eateries -->
	<li>
	  <span class="eatery-name">${eatery.name}</span>
	  <span>${eatery.dist} miles</span>
	  <a href=${links:self.href}>
	    <button>Select</button>
	  </a>
	</li>
      </ul>

    The handler for the Select button should be set up to set
    the eatery-url attribute for the eatery-details component.

    This should be followed by up-to two scrolling links:

      <div class="scroll">
	<!-- only when ${wsData.links:prev} -->
	<a rel="prev" href="${wsData.links:prev.href}">
	  <button>&lt;</button>
	</a>
	<!-- only when ${wsData.links:next} -->
	<a rel="next" href="${wsData.links:next.href}">
	  <button>&gt;</button>
	</a>
      </div>

    When the above scrolling links are clicked, the results should
    be scrolled back-and-forth.

*/
class EateryResults extends HTMLElement {


    static get observedAttributes() { return [ 'ws-url', 'cuisine', ]; }

    async attributeChangedCallback(name, oldValue, newValue) {
        const location=await geoLoc()
        const baseurl=this.getAttribute('ws-url')
        const url = new URL( baseurl);
        url.pathname='eateries'+'/'+location.lat
            +","+location.lng

        console.log(url)

        fetchData(url+"?cuisine"+"="+newValue)
            .then(wsData => {
                console.log(wsData.eateries)
                for(let i of wsData.eateries) {
                    const hdr = (newElement('ul', {class: 'eatery-results'}));
                    hdr.appendChild(newElement('li', {},));
                    hdr.appendChild(newElement('span', {class: 'eatery-name'}, i.name));
                    hdr.appendChild(newElement('span', {}, i.dist + " " + "miles"));
                    const buttonSelect=newElement('button', {},'Select');
                    buttonSelect.addEventListener('click', ev => {
                        ev.preventDefault();
                        document.querySelector('eatery-details').
                        setAttribute('eatery-url', `${this.getAttribute('ws-url')}/eateries/${i.id}`);
                    });
                    hdr.appendChild(buttonSelect)
                    hdr.scrollIntoView(true)
                    this.append(hdr);

                }
            });
    }

    //TODO auxiliary methods
}

//register custom-element as eatery-results
customElements.define('eatery-results', EateryResults);


/*
  A component which shows the details of an eatery.

  When created, it is set up with a buyFn *property* which should be
  called with an eatery-id and item-id to order a single unit of the
  item item-id belonging to eatery-id.

  The component has a single attribute: eatery-url which is the url
  for the web service which provides details for a particular eatery.

  This component does not do anything when first connected to the DOM.
  It must respond to changes in its eatery-url attribute.  It must
  call the web service corresponding to the eatery-url and set it's
  content corresponding to the pseudo-HTML shown below (dynamic data
  is shown within ${...} and wsData is the data returned from the
  web-service call):


      <h2 class="eatery-name">${wsData.name} Menu</h2>
      <ul class="eatery-categories">
	<!-- repeat for each category in wsData.menuCategories -->
	<button class="menu-category">${category}</button>
      </ul>
      <!-- will be populated with items for category when clicked above -->
      <div id="category-details"></div>

  The handler for the menu-category button should populate the
  category-details div for the button's category as follows:

      <h2>${category}</h2>
      <ul class="category-items">
	<!-- repeat for each item in wsData.flatMenu[wsData.menu[category]] -->
	<li>
	  <span class="item-name">${item.name}</span>
	  <span class="item-price">${item.price}</span>
	  <span class="item-details">${item.details}</span>
	  <button class="item-buy">Buy</button>
	</li>
      </ul>

  The handler for the Buy button should be set up to call
  buyFn(eatery.id, item.id).

*/

class EateryDetails extends HTMLElement {

    static get observedAttributes() { return [ 'eatery-url', ]; }

    async attributeChangedCallback(name, oldValue, newValue) {
        try {
            fetchData(this.getAttribute('eatery-url'), {  })
                .then(wsData => {
                    console.log(wsData);
                    const name = `${wsData.name} Menu`;
                    const hdr = newElement('h2', { class: 'eatery-name' }, name);

                    for (var i = 0; i < wsData.menuCategories.length; i++) {
                        const category = `${wsData.menuCategories[i]} `;
                        const category1=wsData.menuCategories[i]
                        hdr.appendChild(newElement('ul', { class: 'eatery-categories' }));
                        const button=newElement('button', { class: 'menu-category' },category);

                        button.addEventListener('click', ev => {
                            ev.preventDefault();
                            console.log(category1)
                            console.log( )
                            hdr.appendChild(newElement('div', { id: 'category-details' }));
                            hdr.appendChild(newElement('h2',{} ,category ));
                            hdr.appendChild(newElement('ul', { class: 'category-items' }));
                            for(i of wsData.menu[category1]) {
                                console.log(i)
                                hdr.appendChild(newElement('li',{} , ));
                                hdr.appendChild(newElement('span', {class: 'item-name'},wsData.flatMenu[i].name));
                                hdr.appendChild(newElement('span', {class: 'item-price'},wsData.flatMenu[i].price));
                                hdr.appendChild(newElement('span', {class: 'item-details'},wsData.flatMenu[i].details));
                                const buttonItemBuy=newElement('button', { class: 'item-buy' },'Buy');

                                buttonItemBuy.addEventListener('click', ev => {
                                    this.buyFn(i,wsData.id)
                                    ev.preventDefault();
                                });
                                hdr.appendChild(buttonItemBuy)

                            }


                        });
                        hdr.appendChild(button)
                    }
                    this.append(hdr);
                });

        }
        catch (err) {
            return new AppErrors().add(err);
        }
        //TODO
    }


    //TODO auxiliary methods

}

//register custom-element as eatery-details
customElements.define('eatery-details', EateryDetails);

async function fetchData(url = '', data = {}) {

    const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
    });
    return response.json();
}



/** Given a list of links and a rel value, return the href for the
 *  link in links having the specified value.
 */
function getHref(links, rel) {
    return links.find(link => link.rel === rel)?.href;
}

//TODO auxiliary functions

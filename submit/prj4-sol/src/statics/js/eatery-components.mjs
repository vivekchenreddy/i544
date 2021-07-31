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
        try {

            let count=1
            console.log("======clicked=========",count)
            console.log(newValue)

            let AcualUrl;
            const location = await geoLoc()
            const baseurl = this.getAttribute('ws-url')
            const url = new URL(baseurl);
            url.pathname = 'eateries' + '/' + location.lat
                + "," + location.lng
            if(!oldValue) {
                AcualUrl = url + "?cuisine" + "=" + newValue
            }else {
                if (name === "a") {
                    AcualUrl = oldValue
                }
                else{
                    AcualUrl = url + "?cuisine" + "=" + newValue
                }
            }
            console.log(AcualUrl)
            let wsData=await fetchData(AcualUrl)
            // let a=wsDataFn(wsData,baseurl)
            let hdr,hdr2
            hdr=newElement('ul', {class: 'eatery-results'},);

            for (let i of wsData.eateries) {
                const spanattribute=newElement('span', {class: 'eatery-name'}, i.name);
                const spanattribute1=newElement('span', {}, i.dist + " " + "miles");
                const buttonSelect = newElement('button', {}, 'Select');
                buttonSelect.addEventListener('click', async ev => {
                    ev.currentTarget
                    ev.preventDefault()
                    console.log(this.getAttribute('ws-url'))
                    await this.attributeChangedCallback('a', ev.currentTarget.parentNode.href, 'b')

                    document.querySelector('eatery-details').setAttribute('eatery-url', `${baseurl}/eateries/${i.id}`)

                    // this.);
                });
                const aattribute=newElement('a', {class:'select-eatery', href: getHref(wsData.links, 'self')},buttonSelect );

                hdr2=newElement('li', {},);
                hdr2.append(spanattribute)
                hdr2.append(spanattribute1)
                hdr2.append(aattribute)
                hdr.append(hdr2)

            }
            const hdr6=newElement('div', {class: 'scroll'})

            if(getHref(wsData.links,'prev')!==undefined)
            {
                const buttonLt = newElement('button', {}, '<');
                buttonLt.addEventListener('click', async ev => {
                    // ev.currentTarget.parentNode.href
                    ev.preventDefault()

                    await this.attributeChangedCallback('a', ev.currentTarget.parentNode.href, 'b')


                });
                console.log("=llll==")

                const hdr4 = newElement('a', {rel: 'prev', href: getHref(wsData.links, 'prev')}, buttonLt)
                hdr6.append(hdr4)

            }
            if(getHref(wsData.links,'next')!==undefined) {
                const buttonGt = newElement('button', {}, `>`);
                buttonGt.addEventListener('click', async ev => {
                    ev.preventDefault()
                    await this.attributeChangedCallback('a', ev.currentTarget.parentNode.href,newValue )
                });

                const hdr5 = newElement('a', {rel: 'next', href: getHref(wsData.links, 'next')}, buttonGt)

                hdr6.append(hdr5)
            }
            // this.innerHTML="";



            // hdrmain.append(hdr6)
            this.innerHTML=""
            this.append(hdr)

            this.append(hdr6)


            // console.log(hdr[0])


        }
        catch (err) {
            return new AppErrors().add(err);
        }
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

            const wsData=await fetchData(this.getAttribute('eatery-url'))
            console.log(wsData);
            let hdr5,hdr6,hdr7,button,ulattribute1,categoryDetails
            const name = `${wsData.name} Menu`;
            const hdr = newElement('h2', { class: 'eatery-name' }, name);
            const ulattribute=newElement('ul', { class: 'eatery-categories' });
            for (var i = 0; i < wsData.menuCategories.length; i++) {
                const category1 = wsData.menuCategories[i]
                this.innerHTML="";

                button = newElement('button', {class: 'menu-category'}, category1);
                button.addEventListener('click', ev => {
                    ev.preventDefault();
                    const div = document.querySelector('#category-details');
                    div.innerHTML = ""
                    // categoryDetails=newElement('div', { id: 'category-details' },);
                    hdr6=newElement('h2',{} ,category1 );
                    // if(document.getElementById('category-items')!==null ) {
                    //     document.getElementById('category-items').innerHTML = ""
                    // }
                    ulattribute1=newElement('ul',{class:'category-items'},)

                    for(i of wsData.menu[category1]) {

                        hdr5=newElement('li', {},);
                        console.log(i)
                        const spanattribute=newElement('span', {class: 'item-name'},wsData.flatMenu[i].name);
                        const spanattribute1=newElement('span', {class: 'item-price'},wsData.flatMenu[i].price);
                        const spanattribute2=newElement('span', {class: 'item-details'},wsData.flatMenu[i].details);

                        const buttonItemBuy = newElement('button', { class: 'item-buy' },'Buy');
                        buttonItemBuy.addEventListener('click', ev => {
                            this.buyFn(wsData.id,wsData.flatMenu[i].id)
                            ev.preventDefault();
                        });

                        hdr5.append(spanattribute)
                        hdr5.append(spanattribute1)
                        hdr5.append(spanattribute2)
                        hdr5.append(buttonItemBuy)
                        ulattribute1.append(hdr5)

                    }


                    div.append(hdr6)
                    div.append(ulattribute1)
                    div.scrollIntoView();


                    // if(document.getElementById('category-details')!==null) {
                    //     document.getElementById('category-details').innerHTML=""
                    // }
                   // this.append(categoryDetails);


                });

                ulattribute.append(button)

            }

            this.append(hdr)
            this.append(ulattribute);
            categoryDetails=newElement('div', { id: 'category-details' },);

            this.append(categoryDetails);




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

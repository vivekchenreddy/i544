import './eatery-components.mjs'; //import only for side-effects

const DEFAULT_WS_URL = 'https://zdu.binghamton.edu:2345';

function getWsUrl() {
  const locationUrl = new URL(window.location.href);
  return locationUrl.searchParams.get('ws-url') ?? DEFAULT_WS_URL;
}

async function go() {
  const wsUrl = getWsUrl();

  const eateryResults = document.querySelector('eatery-results');
  eateryResults.setAttribute('ws-url', wsUrl);
  document.querySelector('eatery-details').buyFn = buy;

  //uncomment to start developing eatery-details component
  //with eatery-id hardcoded to 9_99 "House of Chang"
  // document.querySelector('eatery-details').
  //   setAttribute('eatery-url', `${wsUrl}/eateries/9_99`);


  const select = document.querySelector('#cuisine');
  select.addEventListener('change', ev => {
    const cuisine = ev.target.value;
    if (cuisine) eateryResults.setAttribute('cuisine', cuisine);
  });
}

//placeholder function to add 1 unit of itemId from eateryId to order
function buy(eateryId, itemId) {
  alert(`added 1 unit of ${itemId} from eatery ${eateryId} to order`);
}

await go();

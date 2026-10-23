import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBarbora, parseRimi, parseGeneric, parseHtmlCards, parseUnitPriceText, pickBest } from '../scripts/sources.mjs';
import { SEARCH_TERMS } from '../scripts/search-terms.mjs';
import { INGREDIENTS } from '../js/data.js';
import { priceInfo, livePackPrice } from '../js/planner.js';

test('vieneto kainos tekstas', () => {
  assert.deepEqual(parseUnitPriceText('1,09 €/kg'), { unitPrice: 1.09, unit: 'kg' });
  assert.deepEqual(parseUnitPriceText('2.50 € / l'), { unitPrice: 2.5, unit: 'l' });
});

test('Barbora: b_productList', () => {
  const html = `<script>window.b_productList = [{"title":"Pienas DVARO 2,5%, 1 l","price":1.19,"retail_price":1.49,"comparative_unit":"l","comparative_unit_price":1.19,"status":"active","Url":"pienas-dvaro"},{"title":"Šokoladinis pienas","price":0.99,"status":"active"}];</script>`;
  const items = parseBarbora(html);
  assert.equal(items.length, 2);
  assert.equal(items[0].oldPrice, 1.49);
  assert.ok(items[0].promo);
  const best = pickBest(items, SEARCH_TERMS.pienas, INGREDIENTS.pienas);
  assert.match(best.title, /DVARO/);
});

test('Rimi: data-gtm-eec-product kortelės', () => {
  const html = `<div class="js-product-container" data-gtm-eec-product='{"id":"1","name":"Morkos, 1 kg","price":0.69}'>
    <div class="old-price-tag card__old-price"><span>0,99€</span></div>
    <p class="card__price-per">0,69 €/kg</p><a href="/e-parduotuve/lt/produktai/morkos/p/123">x</a></div>`;
  const [p] = parseRimi(html);
  assert.equal(p.price, 0.69);
  assert.equal(p.unitPrice, 0.69);
  assert.equal(p.unit, 'kg');
  assert.equal(p.oldPrice, 0.99);
  assert.ok(p.promo);
  assert.equal(p.url, 'https://www.rimi.lt/e-parduotuve/lt/produktai/morkos/p/123');
});

test('bendrasis parseris: JSON API (Lidl tipo)', () => {
  const json = JSON.stringify({ items: [{ gridbox: { data: { fullTitle: 'Bananai', price: { price: 1.19, oldPrice: 1.49, basePrice: { text: '1 kg = 1.19' } } } } }] });
  const [p] = parseGeneric(json);
  assert.equal(p.title, 'Bananai');
  assert.equal(p.price, 1.19);
  assert.equal(p.oldPrice, 1.49);
  assert.equal(p.unitPrice, 1.19);
  assert.equal(p.unit, 'kg');
});

test('bendrasis parseris: __NEXT_DATA__ ir ld+json', () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">{"props":{"products":[{"name":"Grikiai 800 g","price":"1,39","unitPrice":1.74,"unit":"kg"}]}}</script>
  <script type="application/ld+json">{"@type":"Product","name":"Ryžiai 1 kg","offers":{"price":"1.59"}}</script>`;
  const items = parseGeneric(html);
  assert.equal(items.length, 2);
  assert.equal(items.find((i) => /Grikiai/.test(i.title)).unitPrice, 1.74);
});

test('HTML kortelės (akcijų puslapis)', () => {
  const html = '<div class="product-title">Svogūnai, 1 kg</div><span class="price">0,59 €</span><s>0,89 €</s>';
  const [p] = parseHtmlCards(html);
  assert.equal(p.title, 'Svogūnai, 1 kg');
  assert.equal(p.price, 0.59);
});

test('gyvos kainos naudojamos ir perskaičiuojamos pakuotei', () => {
  const live = { updatedAt: '2026-10-23T04:00:00Z', stores: { lidl: { bulves: { price: 0.99, unitPrice: 0.5, unit: 'kg', oldPrice: 1.29, promo: true } } } };
  assert.equal(livePackPrice(INGREDIENTS.bulves, live.stores.lidl.bulves), 1); // 2 kg pakuotė
  const info = priceInfo('bulves', 'lidl', { live, todayIso: '2026-10-24' });
  assert.equal(info.source, 'live');
  assert.ok(info.promo);
  // pasenę duomenys ignoruojami
  assert.equal(priceInfo('bulves', 'lidl', { live, todayIso: '2026-12-01' }).source, 'estimate');
  // rankinė akcija turi pirmenybę
  const promos = [{ ingId: 'bulves', store: 'lidl', packPrice: 0.79, until: '2026-10-30' }];
  assert.equal(priceInfo('bulves', 'lidl', { live, promos, todayIso: '2026-10-24' }).price, 0.79);
});

test('užklausų antraštės – tik ASCII', async () => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../scripts/fetch-prices.mjs', import.meta.url), 'utf8');
  const headers = src.slice(src.indexOf('headers: {'), src.indexOf('signal:'));
  const values = [...headers.matchAll(/:\s*'([^']*)'/g)].map((m) => m[1]);
  assert.ok(values.length >= 3);
  for (const v of values) assert.match(v, /^[\x20-\x7e]*$/, v);
});

test('atitikmenys: atmetamas ėdalas, netinkamos pakuotės ir panašūs produktai', async () => {
  const { matches } = await import('../scripts/sources.mjs');
  const T = SEARCH_TERMS;
  assert.equal(matches('Šlapias ėd. katėms One Sterilcat lašiša 4x85g', T.lasisa), false);
  assert.equal(matches('Šviežia lašišos filė, 1 kg', T.lasisa), true);
  assert.equal(matches('Liet.fas.bulvės salotoms 45+, kg', T.salotos), false);
  assert.equal(matches('Virtos bulvės su krapais RTE, 430g', T.zalumynai), false);
  assert.equal(matches('Krapai, 50 g', T.zalumynai), true);
  assert.equal(matches('Mėlyn. vynuogės MOLDOVA, 1kl., 1kg', T.uogos), false);
  assert.equal(matches('Šaldytos braškės RIMI, 400 g', T.uogos), true);
  assert.equal(matches('Valg. ledai su mišk. uog. įd. RIMI, 120ml/72g', T.ledai), false);
  assert.equal(matches('Vaniliniai ledai RIMI, 1 l', T.ledai), true);
  assert.equal(matches('Rieb. tepinys su sviestu VILNIUS, 50 %, 400 g', T.sviestas), false);
  assert.equal(matches('Nulupti pomidorai RIMI SMART, 800 g', T.pomidorai), false);
  assert.equal(matches('Rūgštynių sriuba su rūkyta šonine KKF, 480 g', T.sonine), false);
});

test('atmetami kainos požiūriu neįtikėtini atitikmenys', () => {
  const ing = INGREDIENTS.lasisa; // 250 g ~5 €
  const products = [
    { title: 'Lašišos filė', price: 0.5, unitPrice: 2, unit: 'kg' }, // per pigu – greičiausiai ne tas produktas
    { title: 'Lašišos filė', price: 4.5, unitPrice: 18, unit: 'kg' },
  ];
  const accept = (p) => { const pack = livePackPrice(ing, p); return pack >= ing.base / 3 && pack <= ing.base * 3; };
  assert.equal(pickBest(products, SEARCH_TERMS.lasisa, ing, accept).unitPrice, 18);
});

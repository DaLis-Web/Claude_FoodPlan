// Internetinių parduotuvių paieškos rezultatų parseriai.
// Svetainių struktūra keičiasi, todėl kiekvienas parseris grąžina tuščią sąrašą, jei nieko neatpažįsta,
// o fetch-prices.mjs tokiu atveju palieka ankstesnius duomenis.

// mode: 'search' – užklausa kiekvienam produktui; 'catalog' – vienas akcijų puslapis, iš kurio atrenkami visi produktai.
// URL šablonai gali pasikeisti – tuomet pakanka pataisyti čia.
export const SOURCES = {
  maxima: {
    name: 'Barbora (Maxima)',
    mode: 'search',
    url: (q) => `https://www.barbora.lt/paieska?q=${encodeURIComponent(q)}`,
    parse: (t) => firstNonEmpty(parseBarbora(t), parseGeneric(t)),
  },
  rimi: {
    name: 'Rimi e-parduotuvė',
    mode: 'search',
    url: (q) => `https://www.rimi.lt/e-parduotuve/lt/paieska?query=${encodeURIComponent(q)}`,
    parse: (t) => firstNonEmpty(parseRimi(t), parseGeneric(t)),
  },
  iki: {
    name: 'IKI (LastMile)',
    mode: 'search',
    url: (q) => `https://lastmile.lt/chain/IKI/search?q=${encodeURIComponent(q)}`,
    parse: (t) => parseLastmile(t, /iki/i),
  },
  lidl: {
    name: 'Lidl',
    mode: 'search',
    // Tą pačią API naudoja lidl.lt paieškos puslapis (searchApiVersion 2.1.0).
    url: (q) => `https://www.lidl.lt/q/api/search?q=${encodeURIComponent(q)}&locale=lt_LT&assortment=LT&version=2.1.0`,
    parse: parseGeneric,
  },
  norfa: {
    name: 'Norfa akcijos',
    mode: 'catalog',
    url: () => 'https://www.norfa.lt/akcijos/',
    parse: (t) => firstNonEmpty(parseNorfa(t), parseGeneric(t)),
  },
};

function firstNonEmpty(...lists) {
  return lists.find((l) => l && l.length) || [];
}

export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function normUnit(u) {
  if (!u) return null;
  const s = String(u).toLowerCase().replace(/[^a-ząčęėįšųūž.]/g, '');
  if (/^kg|^kilogram/.test(s)) return 'kg';
  if (/^l$|^l\.|^litr/.test(s)) return 'l';
  if (/^vnt|^vienet|^pc|^pak/.test(s)) return 'vnt';
  return null;
}

// „1,09 €/kg“ -> { unitPrice: 1.09, unit: 'kg' }
export function parseUnitPriceText(text) {
  if (!text) return {};
  const m = String(text).replace(/\s+/g, ' ').match(/(\d+[.,]\d+|\d+)\s*€?\s*\/\s*([a-ząčęėįšųūž.]+)/i);
  if (!m) return {};
  return { unitPrice: num(m[1]), unit: normUnit(m[2]) };
}

export function decodeEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Ištraukia JSON masyvą/objektą, prasidedantį nuo `start` indekso (skliaustų balansavimas).
export function extractJson(text, start) {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// Barbora įterpia produktų sąrašą kaip `window.b_productList = [...]`.
export function parseBarbora(html) {
  const out = [];
  const idx = html.search(/b_productList\s*=\s*\[/);
  if (idx >= 0) {
    const start = html.indexOf('[', idx);
    const json = extractJson(html, start);
    try {
      for (const p of JSON.parse(json)) {
        const price = num(p.price);
        if (!price || (p.status && p.status !== 'active')) continue;
        const old = num(p.retail_price ?? p.old_price ?? p.oldPrice ?? p.promotion?.old_price);
        const promo = !!(p.promotion || p.promotions?.length || p.is_promotion || (old && old > price));
        out.push({
          title: p.title || p.name,
          price,
          unitPrice: num(p.comparative_unit_price),
          unit: normUnit(p.comparative_unit),
          oldPrice: old && old > price ? old : null,
          promo,
          validUntil: p.promotion?.end_date || p.promotion?.date_to || null,
          url: p.Url ? `https://www.barbora.lt/produktai/${p.Url}` : null,
        });
      }
    } catch {
      // nepavyko – grąžinsime tai, ką turime (galbūt JSON-LD)
    }
  }
  return out;
}

// Rimi produktų kortelės turi atributą data-gtm-eec-product='{"name":..,"price":..}'.
export function parseRimi(html) {
  const out = [];
  const parts = html.split(/data-gtm-eec-product=/).slice(1);
  for (const part of parts) {
    const q = part[0];
    if (q !== '"' && q !== "'") continue;
    const end = part.indexOf(q, 1);
    let data;
    try {
      data = JSON.parse(decodeEntities(part.slice(1, end)));
    } catch {
      continue;
    }
    const price = num(data.price);
    if (!price) continue;
    // Kortelės HTML iki kito produkto.
    const card = part.slice(end, end + 6000);
    const per = card.match(/class="[^"]*card__price-per[^"]*"[^>]*>([\s\S]*?)<\//);
    const oldM = card.match(/class="[^"]*old-price[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/);
    const href = card.match(/href="(\/e-parduotuve\/[^"]+\/p\/[^"]+)"/);
    const { unitPrice, unit } = parseUnitPriceText(per ? stripTags(per[1]) : '');
    const old = oldM ? num(stripTags(oldM[1])) : null;
    out.push({
      title: data.name,
      price,
      unitPrice: unitPrice ?? null,
      unit: unit ?? null,
      oldPrice: old && old > price ? old : null,
      promo: !!(old && old > price) || /price-badge|promo|akcija/i.test(card.slice(0, 2500)),
      validUntil: null,
      url: href ? `https://www.rimi.lt${href[1]}` : null,
    });
  }
  return out;
}

// Bendras atsarginis variantas: schema.org Product JSON-LD.
export function parseJsonLd(html) {
  const out = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const list = Array.isArray(data) ? data : data.itemListElement ? data.itemListElement.map((x) => x.item || x) : [data];
    for (const p of list) {
      if (!p || p['@type'] !== 'Product') continue;
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const price = num(offer?.price);
      if (!price) continue;
      out.push({ title: p.name, price, unitPrice: null, unit: null, oldPrice: null, promo: false, validUntil: offer?.priceValidUntil || null, url: p.url || null });
    }
  }
  return out;
}

// Gyvūnų ėdalas ir panašūs dažnai patenka į paiešką („lašiša katėms“) – atmetame visada.
const GLOBAL_NOT = ['katėms', 'kačių', 'kač.', 'šunims', 'šunų', 'ėd.', 'ėdalas', 'gyvūn', 'kūdikių', 'kūdik', 'vaikų košė', 'skonio', 'mėn.)', 'nuo 6 mėn', 'nuo 4 mėn', 'nuo 8 mėn'];

/**
 * Jei parduotuvė nenurodo vieneto kainos, ją apskaičiuojame iš pavadinime nurodyto kiekio
 * („PIEMENĖLIO pienas, 0,5 l“ → 1,30 €/l). Kiekiai kaip „4x85g“ dauginami.
 */
export function withUnitPrice(p) {
  if (p.unitPrice > 0 || !(p.price > 0)) return p;
  const t = String(p.title || '').toLowerCase().replace(/,/g, '.');
  const all = [...t.matchAll(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b(?:\s*[x×]\s*(\d+))?/g)];
  const m = all[all.length - 1];
  if (m) {
    const mult = (m[1] ? Number(m[1]) : 1) * (m[4] ? Number(m[4]) : 1);
    let qty = Number(m[2]) * mult;
    const u = m[3];
    if (u === 'g' || u === 'ml') qty /= 1000;
    if (qty > 0) return { ...p, unitPrice: Math.round((p.price / qty) * 100) / 100, unit: u === 'g' || u === 'kg' ? 'kg' : 'l' };
  }
  const pcs = t.match(/(\d+)\s*vnt/);
  if (pcs && Number(pcs[1]) > 0) return { ...p, unitPrice: Math.round((p.price / Number(pcs[1])) * 1000) / 1000, unit: 'vnt' };
  return p;
}

// `must` – bent vienas fragmentas; `all` – visi fragmentai; `not` – nė vieno; `re` – pavadinimas atitinka (pvz. tūris).
// Fragmentas turi prasidėti žodžio pradžioje („alus“ neturi sutapti su „natūrALUS“).
const wordStart = (t, w) => {
  let i = t.indexOf(w);
  while (i >= 0) {
    if (i === 0 || !/[a-ząčęėįšųūž0-9]/.test(t[i - 1])) return true;
    i = t.indexOf(w, i + 1);
  }
  return false;
};

export function matches(title, term) {
  const t = String(title || '').toLowerCase();
  if (GLOBAL_NOT.some((w) => t.includes(w))) return false;
  if (term.must && !term.must.some((w) => wordStart(t, w))) return false;
  if (term.all && !term.all.every((w) => wordStart(t, w))) return false;
  if (term.not && term.not.some((w) => t.includes(w))) return false;
  if (term.re && !term.re.test(t)) return false;
  return true;
}

/**
 * Iš paieškos rezultatų išrenka pigiausią tinkamą produktą (pagal vieneto kainą, jei ji žinoma).
 * `ing` – produktas iš js/data.js (reikia vieneto ir pakuotės dydžio palyginimui).
 */
export function pickBest(products, term, ing, accept = () => true) {
  const wantUnit = ing.unit === 'g' ? 'kg' : ing.unit === 'ml' ? 'l' : 'vnt';
  const ok = products.map(withUnitPrice).filter((p) => matches(p.title, term) && accept(p));
  if (!ok.length) return null;
  const withUnit = ok.filter((p) => p.unit === wantUnit && p.unitPrice > 0);
  const pool = withUnit.length ? withUnit : ok;
  const key = (p) => (withUnit.length ? p.unitPrice : p.price);
  return pool.reduce((best, p) => (key(p) < key(best) ? p : best));
}

// ---------- Bendrasis parseris ----------
// Randa visus JSON blokus (JSON atsakymas, __NEXT_DATA__, application/json, ld+json, window.X = {...})
// ir rekursyviai ieško objektų, turinčių pavadinimą ir kainą.

const NAME_KEYS = ['fullTitle', 'title', 'name', 'productName', 'displayName'];
const PRICE_KEYS = ['price', 'currentPrice', 'salePrice', 'finalPrice', 'priceValue', 'value'];
const OLD_KEYS = ['oldPrice', 'old_price', 'regularPrice', 'retail_price', 'originalPrice', 'priceBefore', 'listPrice'];
const UNIT_PRICE_KEYS = ['comparative_unit_price', 'unitPrice', 'pricePerUnit', 'basePrice', 'comparisonPrice'];
const UNIT_KEYS = ['comparative_unit', 'unit', 'baseUnit', 'comparisonUnit', 'unitOfMeasure'];

function pick(obj, keys) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return undefined;
}

// Kaina gali būti skaičius, eilutė arba objektas ({ price, oldPrice, basePrice: {text} }).
function priceFrom(v) {
  if (v && typeof v === 'object') {
    const inner = pick(v, PRICE_KEYS);
    return inner !== undefined ? priceFrom(inner) : null;
  }
  const n = num(v);
  return n && n > 0 && n < 500 ? n : null;
}

// Pavadinimas gali būti vertimų objektas ({ lt: "...", en: "..." }).
function textFrom(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const t = v.lt ?? v.lt_LT ?? v.LT ?? v.en ?? Object.values(v).find((x) => typeof x === 'string');
    return typeof t === 'string' ? t : undefined;
  }
  return undefined;
}

function productFrom(o) {
  const title = textFrom(pick(o, NAME_KEYS));
  if (typeof title !== 'string' || title.length < 3 || title.length > 200) return null;
  let priceSrc = pick(o, PRICE_KEYS);
  let ctx = o;
  if (priceSrc === undefined && o.offers) {
    ctx = Array.isArray(o.offers) ? o.offers[0] || {} : o.offers;
    priceSrc = pick(ctx, PRICE_KEYS);
  }
  // Lidl: { gridbox: { data: { price: { price, oldPrice, basePrice: { text: "1 kg = 2.49" } } } } }
  const priceObj = priceSrc && typeof priceSrc === 'object' ? priceSrc : null;
  const price = priceFrom(priceSrc);
  if (!price) return null;
  const oldRaw = pick(priceObj || {}, OLD_KEYS) ?? pick(ctx, OLD_KEYS) ?? pick(o, OLD_KEYS);
  const old = priceFrom(oldRaw);
  let unitPrice = priceFrom(pick(priceObj || {}, UNIT_PRICE_KEYS) ?? pick(o, UNIT_PRICE_KEYS));
  let unit = normUnit(pick(o, UNIT_KEYS));
  if (unitPrice === null) {
    const txt = JSON.stringify(priceObj?.basePrice ?? o.basePrice ?? o.unitPriceText ?? '');
    const a = parseUnitPriceText(txt);
    const b = txt.match(/1\s*(kg|l|vnt)\.?\s*=\s*(\d+[.,]?\d*)/i);
    if (a.unitPrice) ({ unitPrice, unit } = a);
    else if (b) {
      unitPrice = num(b[2]);
      unit = normUnit(b[1]);
    }
  }
  const promo = !!(old && old > price) || !!(o.promotion || o.isPromotion || o.discount || priceObj?.discount);
  const url = pick(o, ['url', 'Url', 'canonicalUrl', 'link', 'href']);
  return {
    title: title.replace(/\s+/g, ' ').trim(),
    price,
    unitPrice: unitPrice ?? null,
    unit: unitPrice ? unit : null,
    oldPrice: old && old > price ? old : null,
    promo,
    validUntil: pick(ctx, ['priceValidUntil', 'validTo', 'endDate', 'end_date']) || null,
    url: typeof url === 'string' ? url : null,
  };
}

function walk(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 25) return;
  if (Array.isArray(node)) {
    for (const x of node) walk(x, out, depth + 1);
    return;
  }
  const p = productFrom(node);
  if (p) out.push(p);
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, depth + 1);
}

export function jsonBlocks(text) {
  const blocks = [];
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      blocks.push(JSON.parse(t));
      return blocks;
    } catch {
      // ne JSON
    }
  }
  const re = /<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(text))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      // praleidžiame
    }
  }
  const assign = /(?:window\.[\w$]+|__[A-Z_]+__)\s*=\s*([[{])/g;
  while ((m = assign.exec(text))) {
    const json = extractJson(text, m.index + m[0].length - 1);
    if (!json) continue;
    try {
      blocks.push(JSON.parse(json));
    } catch {
      // praleidžiame
    }
  }
  return blocks;
}

export function parseGeneric(text) {
  const out = [];
  for (const b of jsonBlocks(text)) walk(b, out);
  // Pašaliname dublikatus (tas pats produktas gali būti keliuose blokuose).
  const seen = new Set();
  return out.filter((p) => {
    const k = `${p.title}|${p.price}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Paskutinė galimybė: HTML kortelės su pavadinimu ir kaina „1,99 €“ šalia.
export function parseHtmlCards(html) {
  const out = [];
  const re = /<(?:h\d|p|span|div)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]{3,160}?)<\/(?:h\d|p|span|div)>([\s\S]{0,800}?)(\d+[.,]\d{2})\s*€/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = stripTags(m[1]);
    const price = num(m[3]);
    if (!title || !price) continue;
    const rest = stripTags(m[2]);
    const oldM = rest.match(/(\d+[.,]\d{2})\s*€/);
    const old = oldM ? num(oldM[1]) : null;
    out.push({ title, price, unitPrice: null, unit: null, oldPrice: old && old > price ? old : null, promo: true, validUntil: null, url: null });
  }
  return out;
}

/** Diagnostikai: JSON keliai, kuriuose yra kainos ar pavadinimo raktai (padeda pritaikyti parserį naujai svetainei). */
export function describeJson(text, max = 12) {
  const out = [];
  const seen = new Set();
  const visit = (node, path, depth) => {
    if (!node || typeof node !== 'object' || depth > 30 || out.length >= max) return;
    if (Array.isArray(node)) {
      if (node.length) visit(node[0], `${path}[0]`, depth + 1);
      return;
    }
    const keys = Object.keys(node);
    if (keys.some((k) => /price|prc|kaina|cost/i.test(k))) {
      const shape = path.replace(/\[\d+\]/g, '[]');
      if (!seen.has(shape)) {
        seen.add(shape);
        const sample = JSON.stringify(Object.fromEntries(keys.slice(0, 14).map((k) => [k, typeof node[k] === 'object' ? (Array.isArray(node[k]) ? '[…]' : '{…}') : node[k]])));
        out.push(`${shape}: ${sample.slice(0, 300)}`);
      }
    }
    for (const k of keys) visit(node[k], `${path}.${k}`, depth + 1);
  };
  jsonBlocks(text).forEach((b, i) => visit(b, `#${i}`, 0));
  return out;
}

// ---------- Norfa: akcijų puslapio kortelės ----------
// <div class="c-product c-product--compact"> … <div class="c-product__price">1.39 €</div>
// <div class="c-product__name">Pavadinimas, 1 kg</div> … Galioja 10.23-10.25 d.
export function parseNorfa(html, now = new Date()) {
  const out = [];
  const parts = html.split(/class="c-product c-product--/).slice(1);
  for (const part of parts) {
    const card = part.slice(0, 4000);
    const nameM = card.match(/class="c-product__name"[^>]*>([\s\S]*?)<\/div>/);
    const prices = [...card.matchAll(/class="c-product__(?:price|old-price|price-old)[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => num(stripTags(m[1]))).filter((x) => x > 0);
    if (!nameM || !prices.length) continue;
    const price = Math.min(...prices);
    const old = prices.length > 1 ? Math.max(...prices) : null;
    const until = card.match(/Galioja\s+(?:\d{1,2}\.\d{1,2}\s*-\s*)?(\d{1,2})\.(\d{1,2})/);
    let validUntil = null;
    if (until) {
      let y = now.getFullYear();
      const mm = Number(until[1]);
      if (mm < now.getMonth() + 1 - 6) y++; // metų sandūra
      validUntil = `${y}-${String(mm).padStart(2, '0')}-${String(Number(until[2])).padStart(2, '0')}`;
    }
    out.push({ title: stripTags(nameM[1]), price, unitPrice: null, unit: null, oldPrice: old && old > price ? old : null, promo: true, validUntil, url: 'https://www.norfa.lt/akcijos/' });
  }
  return out;
}

// ---------- LastMile (IKI): Next.js dehydratedState ----------
// props.pageProps.dehydratedState.queries[].state.data[] = { convertedPrice, convertedRegularPrice, chainSlug, product: {...} }
export function parseLastmile(text, chainRe = /iki/i) {
  const out = [];
  const items = [];
  const collect = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 30) return;
    if (Array.isArray(node)) return node.forEach((x) => collect(x, depth + 1));
    if (node.product && typeof node.product === 'object' && ('convertedPrice' in node || 'price' in node || 'prc' in node)) items.push(node);
    for (const v of Object.values(node)) if (v && typeof v === 'object') collect(v, depth + 1);
  };
  for (const b of jsonBlocks(text)) collect(b);
  const chains = new Set();
  for (const it of items) {
    const chain = `${it.chainSlug || ''} ${textFrom(it.chainName) || ''}`;
    chains.add(it.chainSlug);
    if (chainRe && !chainRe.test(chain)) continue;
    const p = it.product;
    const title = textFrom(p.name) || textFrom(p.title) || textFrom(p.fullName);
    if (!title) continue;
    const unit = normUnit(p.conversionMeasure || p.measure);
    const unitPrice = priceFrom(it.convertedPrice);
    const regular = priceFrom(it.convertedRegularPrice);
    const price = priceFrom(it.price ?? it.prc ?? p.price ?? p.prc) ?? null;
    out.push({
      title: title.trim(),
      price: price ?? unitPrice,
      unitPrice: unitPrice ?? null,
      unit: unitPrice ? unit : null,
      oldPrice: null,
      promo: !!(regular && unitPrice && regular > unitPrice + 0.001),
      validUntil: null,
      url: p.slug ? `https://lastmile.lt/product/${p.slug}` : null,
    });
    // Sena kaina perskaičiuojama tuo pačiu santykiu kaip vieneto kaina.
    const last = out[out.length - 1];
    if (last.promo && last.price) last.oldPrice = Math.round(last.price * (regular / unitPrice) * 100) / 100;
  }
  parseLastmile.lastChains = [...chains].filter(Boolean);
  return out;
}

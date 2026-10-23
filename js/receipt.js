// Čekio teksto analizė: parduotuvė, data, suma ir prekės, susietos su programėlės produktais.
// Tekstas gaunamas iš nuotraukos (Tesseract OCR) arba įklijuojamas (pvz. el. čekis).
import { INGREDIENTS, STORES } from './data.js';
import { SEARCH_TERMS } from './search-terms.js';
import { GLOBAL_NOT } from './match.js';

const deaccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const num = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));

// Eilutės, kurios nėra prekės.
const SKIP = /(i[sš]\s*viso|mok[eė]t|pvm|gr[aą][zž]a|kortel|bank|^suma|tarpin|kvit|kasos|kasinink|ačiū|aciu|nuolaid|akcijos nuolaida|apmok|grynais|terminal|autoriz|lojal|taškai|taskai)/i;

// Čekiuose pavadinimai trumpinami („KIAUL.SPRAND.“), raidės be nosinių – lyginame laisviau:
// be diakritikų ir pagal pirmąsias raides (bent 5), nuo žodžio pradžios.
function fragmentHit(t, frag) {
  const f = deaccent(frag).trim();
  if (!f) return 0;
  // Trumpinti („KIAUL.“ → „kiaul“) leidžiame tik vieno žodžio fragmentus.
  const tries = f.length >= 6 && !f.includes(' ') ? [f, f.slice(0, 5)] : [f];
  for (const x of tries) {
    let i = t.indexOf(x);
    while (i >= 0) {
      if (i === 0 || !/[a-z0-9]/.test(t[i - 1])) return x.length;
      i = t.indexOf(x, i + 1);
    }
  }
  return 0;
}

/** Labiausiai tinkantis produktas čekio eilutei arba null. */
export function matchReceiptLine(name) {
  const t = deaccent(name);
  if (GLOBAL_NOT.some((w) => t.includes(deaccent(w)))) return null;
  let best = null;
  let bestScore = 0;
  for (const [id, term] of Object.entries(SEARCH_TERMS)) {
    if (!INGREDIENTS[id]) continue;
    if (term.not && term.not.some((w) => t.includes(deaccent(w)))) continue;
    const hit = Math.max(0, ...(term.must || []).map((w) => fragmentHit(t, w)));
    if (!hit) continue;
    if (term.all && !term.all.every((w) => fragmentHit(t, w))) continue;
    // Ilgesnis sutapimas – tikslesnis; ankstyvesnė vieta eilutėje – svarbesnė (pirmas žodis paprastai produktas).
    const pos = t.indexOf(deaccent((term.must || [''])[0]).slice(0, 4));
    const score = hit * 10 - (pos > 0 ? Math.min(pos, 30) / 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return bestScore >= 36 ? best : null;
}

// Kiekis iš pavadinimo („350G“, „0,5L“, „10VNT“, „2 X“) konvertuotas į produkto vienetus.
export function quantityFor(name, ingId, count = 1, price = null) {
  const ing = INGREDIENTS[ingId];
  if (!ing) return 0;
  const t = deaccent(name).replace(/,/g, '.');
  const m = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|vnt)\b/g)].pop();
  if (m) {
    const v = Number(m[1]);
    const u = m[2];
    if (ing.unit === 'g' && (u === 'kg' || u === 'g')) return (u === 'kg' ? v * 1000 : v) * count;
    if (ing.unit === 'ml' && (u === 'l' || u === 'ml')) return (u === 'l' ? v * 1000 : v) * count;
    if (ing.unit === 'vnt' && u === 'vnt') return v * count;
  }
  // Kiekis nenurodytas: sveriamiems produktams įvertiname iš kainos (pvz. 4,99 € filė ≈ 0,7 kg), kitiems – viena pakuotė.
  if (price > 0 && count === 1 && ing.unit !== 'vnt' && ing.base > 0) {
    const est = (price / ing.base) * ing.pack;
    return Math.round(Math.min(ing.pack * 3 * count, Math.max(ing.pack * 0.3, est)) / 10) * 10;
  }
  return ing.pack * count;
}

/**
 * Išanalizuoja čekio tekstą (popierinio čekio nuotraukos OCR arba el. čekis, pvz. Maxima laiškas).
 * Palaikoma: pavadinimas per kelias eilutes, kiekio/svorio eilutė po preke („0,48 X 0,374 kg“),
 * „AČIŪ nuolaida“ su suma kitoje eilutėje, depozitai, laiško ar Gmail tekstas aplink čekį.
 * Grąžina { store, date, total, discount, items: [{ name, price, count, ingId, qty }] }.
 */
export function parseReceipt(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[>\s]+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const all = lines.join(' ');
  const head = lines.slice(0, 30).join(' ');
  const store = STORES.find((s) => s.match.test(head))?.id || STORES.find((s) => s.match.test(all))?.id || null;

  const dm = all.match(/(20\d\d)[-./](\d{1,2})[-./](\d{1,2})\s+\d{1,2}:\d{2}/) || all.match(/(20\d\d)[-./](\d{1,2})[-./](\d{1,2})/);
  const date = dm ? `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` : null;

  let total = null;
  for (const l of lines) {
    const m = l.match(/(kvito suma|mok[eė]tina suma|i[sš]\s*viso(?! maximos)|mok[eė]ti|suma\s*mok)\D{0,12}(\d+[.,]\d{2})/i);
    if (m && !/pinig/i.test(l)) total = num(m[2]);
  }

  // Jei prieš čekį yra kitas tekstas (pvz. Maxima programėlės „Apsipirkimų istorija“ PDF) –
  // prekių ieškome tik nuo paskutinės čekio antraštės.
  let start = 0;
  lines.forEach((l, i) => {
    if (/pvm mok[eė]tojo kodas|pvm kodas|kvitas baz[eė]je|^j0\b/i.test(l)) start = i + 1;
  });
  const body = lines.slice(start);

  const items = [];
  let discount = 0;
  let buffer = []; // pavadinimo pradžia be kainos (pavadinimas tęsiasi kitoje eilutėje)
  let pendingDiscount = false;
  let skipped = false; // paskutinė eilutė buvo ne prekė (pvz. depozitas) – jos kiekio eilutė ignoruojama
  const last = () => items[items.length - 1];

  for (const l of body) {
    // Po prekių sąrašo – santraukos, PVM, mokėjimas.
    if (/^={4,}|suteiktos naudos|^kvito suma|^be pvm|^tarpin|^i[sš] viso\b/i.test(l)) {
      if (items.length) break;
      buffer = [];
      continue;
    }
    // Kiekio / svorio eilutė po preke: „0,35 X 3 vnt.“, „0,48 X 0,374 kg“, „0,75 X 2 pak.“
    const q = l.match(/^(\d+[.,]\d+)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*(vnt|kg|pak|l|g)?\.?$/i);
    if (q) {
      const it = skipped ? null : last();
      if (it) {
        const amount = num(q[2]);
        const unit = (q[3] || 'vnt').toLowerCase();
        if (unit === 'kg' || unit === 'l' || unit === 'g') it.weight = { amount, unit };
        else it.count = Math.max(1, Math.round(amount));
      }
      buffer = [];
      continue;
    }
    // Nuolaidos eilutė; suma gali būti toje pačioje arba kitoje eilutėje.
    if (/nuolaida|nuolaid\./i.test(l)) {
      const dm2 = l.match(/(-\d+[.,]\d{2})\s*[A-Z]?$/);
      if (dm2 && last()) {
        last().price = Math.round((last().price + num(dm2[1])) * 100) / 100;
        discount += -num(dm2[1]);
      } else pendingDiscount = true;
      buffer = [];
      continue;
    }
    const onlyPrice = l.match(/^(-?\d+[.,]\d{2})\s*[A-Z]?$/);
    if (onlyPrice) {
      const price = num(onlyPrice[1]);
      if (price < 0 || pendingDiscount) {
        if (last()) last().price = Math.round((last().price - Math.abs(price)) * 100) / 100;
        discount += Math.abs(price);
        pendingDiscount = false;
        buffer = [];
        continue;
      }
      if (buffer.length) {
        addItem(buffer.join(' '), price);
        buffer = [];
      }
      continue;
    }
    const m = l.match(/^(.*?[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž].*?)\s+(-?\d+[.,]\d{2})\s*[A-Z]?$/);
    if (m && !l.includes('#')) {
      const name = [...buffer, m[1]].join(' ').trim();
      buffer = [];
      const price = num(m[2]);
      if (price < 0) {
        if (last()) last().price = Math.round((last().price + price) * 100) / 100;
        discount += -price;
        continue;
      }
      addItem(name, price);
      continue;
    }
    // Eilutė be kainos: arba pavadinimo pradžia, arba antraštė / laiško tekstas.
    if (l.includes('#') || SKIP.test(l) || /[:@]|https?|www\./i.test(l)) {
      buffer = [];
      continue;
    }
    buffer = [...buffer, l].slice(-2);
  }

  function addItem(rawName, price) {
    const name = rawName.replace(/\s+\d+[.,]?\d*\s*[xX×*]\s*\d+[.,]\d{2}$/, '').trim();
    skipped = true;
    if (SKIP.test(name) || name.length < 3) return;
    const cm = rawName.match(/(\d+)\s*[xX×*]\s*\d+[.,]\d{2}$/) || rawName.match(/^(\d+)\s*[xX×*]\s/);
    // Depozitas už tarą – ne prekė (suma vis tiek įskaičiuota į čekio sumą).
    if (/depozit/i.test(name)) return;
    items.push({ name, price, count: cm ? Number(cm[1]) : 1 });
    skipped = false;
  }

  for (const it of items) {
    it.ingId = matchReceiptLine(it.name);
    if (!it.ingId) {
      it.qty = 0;
      continue;
    }
    const ing = INGREDIENTS[it.ingId];
    if (it.weight && ((ing.unit === 'g' && /kg|g/.test(it.weight.unit)) || (ing.unit === 'ml' && it.weight.unit === 'l'))) {
      it.qty = Math.round(it.weight.amount * (it.weight.unit === 'g' ? 1 : 1000));
    } else {
      it.qty = quantityFor(it.name, it.ingId, it.count, it.price);
    }
    delete it.weight;
  }
  if (total === null && items.length) total = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
  return { store, date, total, discount: Math.round(discount * 100) / 100, items };
}

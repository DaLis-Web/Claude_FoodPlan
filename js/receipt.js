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
  const tries = f.length >= 6 ? [f, f.slice(0, 5)] : [f];
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
  return bestScore >= 40 ? best : null;
}

// Kiekis iš pavadinimo („350G“, „0,5L“, „10VNT“, „2 X“) konvertuotas į produkto vienetus.
export function quantityFor(name, ingId, count = 1) {
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
  return ing.pack * count;
}

/**
 * Išanalizuoja čekio tekstą.
 * Grąžina { store, date, total, discount, items: [{ name, price, count, ingId, qty }] }.
 */
export function parseReceipt(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const head = lines.slice(0, 8).join(' ');
  const store = STORES.find((s) => s.match.test(head))?.id || STORES.find((s) => s.match.test(lines.join(' ')))?.id || null;

  const dm = lines.join(' ').match(/(20\d\d)[-./](\d{1,2})[-./](\d{1,2})/);
  const date = dm ? `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` : null;

  let total = null;
  for (const l of lines) {
    const m = l.match(/(i[sš]\s*viso|mok[eė]ti|suma\s*mok)\D{0,12}(\d+[.,]\d{2})/i);
    if (m) total = num(m[2]);
  }

  const items = [];
  let discount = 0;
  for (const l of lines) {
    const m = l.match(/^(.*?[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž].*?)\s+(-?\d+[.,]\d{2})\s*[A-Z]?\s*$/);
    if (!m) continue;
    const name = m[1].replace(/\s+\d+[.,]?\d*\s*[xX×*]\s*\d+[.,]\d{2}$/, '').trim();
    const price = num(m[2]);
    if (price < 0 || /nuolaid/i.test(name)) {
      discount += Math.abs(price);
      continue;
    }
    if (SKIP.test(name) || name.length < 3) continue;
    const cm = m[1].match(/(\d+)\s*[xX×*]\s*\d+[.,]\d{2}$/) || m[1].match(/^(\d+)\s*[xX×*]\s/);
    const count = cm ? Number(cm[1]) : 1;
    const ingId = matchReceiptLine(name);
    items.push({ name, price, count, ingId, qty: ingId ? quantityFor(name, ingId, count) : 0 });
  }
  if (total === null && items.length) total = Math.round((items.reduce((s, i) => s + i.price, 0) - discount) * 100) / 100;
  return { store, date, total, discount: Math.round(discount * 100) / 100, items };
}

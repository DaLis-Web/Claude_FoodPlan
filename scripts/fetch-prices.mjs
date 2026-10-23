#!/usr/bin/env node
// Surenka kainas ir akcijas iš internetinių parduotuvių ir įrašo į data/prices.json.
// Paleidimas: node scripts/fetch-prices.mjs [--only=maxima,rimi] [--limit=5]
// Jei parduotuvė negrąžina duomenų, paliekami ankstesni tos parduotuvės duomenys.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INGREDIENTS } from '../js/data.js';
import { SEARCH_TERMS } from './search-terms.mjs';
import { SOURCES, pickBest } from './sources.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'data', 'prices.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? args.only.split(',') : Object.keys(SOURCES);
const limit = args.limit ? Number(args.limit) : Infinity;
const DELAY_MS = 1500; // mandagus tempas, kad neapkrautume svetainių

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MaistoPlanas/1.0; asmeninis kainų palyginimas)',
      'Accept-Language': 'lt-LT,lt;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function readPrevious() {
  try {
    return JSON.parse(await fs.readFile(outFile, 'utf8'));
  } catch {
    return { updatedAt: null, stores: {} };
  }
}

async function main() {
  const prev = await readPrevious();
  const result = { updatedAt: new Date().toISOString(), stores: { ...prev.stores }, sources: { ...(prev.sources || {}) } };
  const ids = Object.keys(SEARCH_TERMS).filter((id) => INGREDIENTS[id]).slice(0, limit);
  let anyFresh = false;

  // Parduotuvės apklausiamos lygiagrečiai, kiekviena savo tempu.
  await Promise.all(only.map(async (storeId) => {
    const src = SOURCES[storeId];
    if (!src) return;
    const rows = {};
    let errors = 0;
    if (src.mode === 'catalog') {
      // Vienas puslapis (pvz. akcijų leidinys) – atrenkame visus atpažintus produktus.
      try {
        const products = src.parse(await fetchText(src.url()));
        for (const id of ids) {
          const best = pickBest(products, SEARCH_TERMS[id], INGREDIENTS[id]);
          if (best) rows[id] = { ...best, promo: true };
        }
        console.log(`${storeId}: ${products.length} produktų puslapyje, atpažinta ${Object.keys(rows).length}`);
      } catch (e) {
        errors++;
        console.warn(`${storeId}: klaida ${e.message}`);
      }
    } else {
      for (const [i, id] of ids.entries()) {
        // Jei pirmosios užklausos nepavyksta visos – svetainė nepasiekiama ar blokuoja, nelaukiame veltui.
        if (i === 4 && errors === 4) {
          console.warn(`${storeId}: pirmos 4 užklausos nepavyko – parduotuvė praleidžiama.`);
          break;
        }
        const term = SEARCH_TERMS[id];
        try {
          const html = await fetchText(src.url(term.q));
          const products = src.parse(html);
          if (!products.length && !rows.__diag) {
            // Diagnostika: ką grąžino svetainė, kai produktų neatpažinome.
            rows.__diag = true;
            const title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '';
            const hints = ['b_productList', 'data-gtm-eec-product', '__NEXT_DATA__', 'ld+json', 'gridbox', 'application/json'].filter((h) => html.includes(h));
            console.warn(`${storeId}: produktų neatpažinta (${html.length} B, title="${title.trim().slice(0, 80)}", žymės: ${hints.join(', ') || 'nėra'})`);
            console.warn(`${storeId}: pradžia: ${html.replace(/\s+/g, ' ').slice(0, 400)}`);
          }
          const best = pickBest(products, term, INGREDIENTS[id]);
          if (best) rows[id] = best;
          console.log(`${storeId} ${id}: ${best ? `${best.price} € ${best.promo ? '(akcija) ' : ''}– ${best.title}` : 'nerasta'}`);
        } catch (e) {
          errors++;
          console.warn(`${storeId} ${id}: klaida ${e.message}`);
        }
        await sleep(DELAY_MS);
      }
    }
    delete rows.__diag;
    const found = Object.keys(rows).length;
    // Akcijų katalogui pakanka ir kelių atitikmenų; paieškai reikia bent 5, kad atmestume sugedusį parserį.
    const minFound = src.mode === 'catalog' ? 1 : Math.min(5, ids.length);
    if (found >= minFound) {
      result.stores[storeId] = rows;
      result.sources[storeId] = { name: src.name, updatedAt: result.updatedAt, found, errors };
      anyFresh = true;
    } else {
      console.warn(`${storeId}: rasta tik ${found} produktų – paliekami ankstesni duomenys.`);
    }
  }));

  if (!anyFresh) {
    console.error('Nepavyko gauti naujų kainų nė iš vienos parduotuvės. Failas nekeičiamas.');
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(result, null, 1) + '\n');
  console.log(`Įrašyta: ${outFile}`);
}

main();

#!/usr/bin/env node
// Surenka receptų nuotraukas iš atvirų šaltinių ir įrašo į data/recipe-images.json.
// 1) TheMealDB (nemokama API, nuotraukas leidžiama naudoti), 2) Wikimedia Commons (tik CC / viešo domeno licencijos).
// Jau rastos nuotraukos neieškomos iš naujo, nebent paleidžiama su --all.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../js/data.js';
import { IMAGE_QUERIES } from './image-queries.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'data', 'recipe-images.json');
const all = process.argv.includes('--all');
const UA = 'MaistoPlanas/1.0 (https://github.com/DaLis-Web/Claude_FoodPlan)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function fromMealDb(q) {
  const d = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
  const m = d.meals?.[0];
  if (!m?.strMealThumb) return null;
  return { url: m.strMealThumb, thumb: `${m.strMealThumb}/medium`, credit: 'TheMealDB', page: `https://www.themealdb.com/meal/${m.idMeal}` };
}

async function fromCommons(q) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8' +
    `&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=640`;
  const d = await getJson(api);
  const pages = Object.values(d.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = norm(q).split(/\s+/).filter((w) => w.length > 3);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 400) continue;
    // Pavadinime turi būti bent vienas paieškos žodis – kitaip tai greičiausiai ne tas patiekalas.
    const t = norm(p.title);
    if (words.length && !words.some((w) => t.includes(w.slice(0, Math.max(4, w.length - 2))))) continue;
    const meta = ii.extmetadata || {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!/^(cc|public domain|pd)/i.test(license) || /nd\b|-nd/i.test(license)) continue;
    const artist = stripHtml(meta.Artist?.value).slice(0, 60) || 'Wikimedia Commons';
    return { url: ii.thumburl || ii.url, thumb: ii.thumburl || ii.url, credit: `${artist} · ${license}`, page: ii.descriptionurl };
  }
  return null;
}

async function main() {
  let prev = {};
  try {
    prev = JSON.parse(await fs.readFile(outFile, 'utf8')).images || {};
  } catch {
    // pirmas paleidimas
  }
  const images = { ...prev };
  let added = 0;
  for (const r of RECIPES) {
    if (images[r.id] && !all) continue;
    const [meal, commons] = IMAGE_QUERIES[r.id] || [null, r.name];
    let img = null;
    try {
      if (meal) img = await fromMealDb(meal);
      if (!img && commons) img = await fromCommons(commons);
    } catch (e) {
      console.warn(`${r.id}: klaida ${e.message}`);
    }
    console.log(`${r.id}: ${img ? `${img.credit} – ${img.url}` : 'nerasta'}`);
    if (img) {
      images[r.id] = img;
      added++;
    }
    await sleep(400);
  }
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify({ updatedAt: new Date().toISOString(), images }, null, 1) + '\n');
  console.log(`Nuotraukų: ${Object.keys(images).length} (naujų ${added})`);
}

main();

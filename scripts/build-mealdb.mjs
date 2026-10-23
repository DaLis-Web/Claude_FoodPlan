#!/usr/bin/env node
// Sujungia TheMealDB importą (data/mealdb-raw.json) su lietuviškais vertimais (data/mealdb-lt.json)
// į programėlės naudojamą data/extra-recipes.json. Įtraukiami tik išversti receptai.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateNutrition } from '../js/nutrition.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = async (f) => JSON.parse(await fs.readFile(path.join(root, 'data', f), 'utf8'));

const raw = (await read('mealdb-raw.json')).recipes;
const lt = await read('mealdb-lt.json');
const recipes = [];
for (const r of raw) {
  const t = lt[r.id];
  if (!t) continue;
  const ing = { ...r.ing, ...(t.ing || {}) }; // rankiniai kiekių pataisymai iš vertimų failo
  const { kcal, protein } = t.ing ? estimateNutrition(ing) : r;
  recipes.push({
    id: r.id,
    name: t.name,
    meals: t.meals || r.meals,
    time: t.time,
    kcal,
    protein,
    servings: r.servings,
    ing,
    other: t.other ?? r.other,
    steps: t.steps,
    image: { url: r.image, thumb: `${r.image}/medium`, credit: 'TheMealDB', page: r.source },
    source: r.source,
  });
}
await fs.writeFile(path.join(root, 'data', 'extra-recipes.json'), JSON.stringify({ recipes }, null, 1) + '\n');
console.log(`Papildomų receptų: ${recipes.length}`);

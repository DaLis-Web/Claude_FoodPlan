#!/usr/bin/env node
// Parsisiunčia visus TheMealDB receptus, susieja ingredientus su programėlės produktais ir
// įrašo tinkamus (≥80 % ingredientų turime) į data/mealdb-raw.json.
// Vertimai į lietuvių k. laikomi atskirai: data/mealdb-lt.json (žr. scripts/build-mealdb.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INGREDIENTS } from '../js/data.js';
import { estimateNutrition } from '../js/nutrition.js';
import { EN_MAP, IGNORE, MINOR, STAPLE_MAP, convertMeasure } from './mealdb-map.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'data', 'mealdb-raw.json');
// TheMealDB nenurodo porcijų – jas nustatome pagal bendrą kalorijų kiekį (~600 kcal porcijai).
const KCAL_PER_SERVING = 600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const SKIP_CATEGORIES = new Set(['Dessert', 'Starter', 'Side', 'Miscellaneous', 'Goat']);

function convert(meal) {
  if (SKIP_CATEGORIES.has(meal.strCategory)) return { skip: 'kategorija' };
  const ing = {};
  const other = [];
  let total = 0;
  let mapped = 0;
  for (let i = 1; i <= 20; i++) {
    const name = String(meal[`strIngredient${i}`] || '').trim().toLowerCase();
    const measure = String(meal[`strMeasure${i}`] || '').trim();
    if (!name) continue;
    const id = EN_MAP[name];
    if (IGNORE.has(name) && !STAPLE_MAP[name]) continue;
    const minor = !id && MINOR.test(name);
    if (!IGNORE.has(name) && !minor) total++;
    if (!id) {
      other.push(`${measure} ${name}`.trim());
      continue;
    }
    if (!IGNORE.has(name)) mapped++;
    const qty = convertMeasure(measure, INGREDIENTS[id], id);
    ing[id] = (ing[id] || 0) + qty;
  }
  const whole = estimateNutrition(ing).kcal;
  const servings = Math.min(10, Math.max(1, Math.round(whole / KCAL_PER_SERVING)));
  for (const id of Object.keys(ing)) ing[id] = Math.round((ing[id] / servings) * 10) / 10;
  const coverage = total ? mapped / total : 0;
  if (mapped < 3 || coverage < 0.8) return { skip: `atitikimas ${Math.round(coverage * 100)} %`, other };
  const { kcal, protein } = estimateNutrition(ing);
  if (kcal < 150) return { skip: 'per mažai kalorijų (greičiausiai užkandis)' };
  return {
    recipe: {
      id: `mdb_${meal.idMeal}`,
      name_en: meal.strMeal,
      category: meal.strCategory,
      area: meal.strArea,
      meals: meal.strCategory === 'Breakfast' ? ['pusryciai'] : ['pietus', 'vakariene'],
      kcal,
      protein,
      ing,
      other,
      coverage: Math.round(coverage * 100),
      servings,
      steps_en: String(meal.strInstructions || '').split(/\r?\n+/).map((s) => s.replace(/^step\s*\d+\s*/i, '').trim()).filter((s) => s.length > 3),
      image: meal.strMealThumb,
      source: `https://www.themealdb.com/meal/${meal.idMeal}`,
    },
  };
}

async function main() {
  const meals = new Map();
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    try {
      const d = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
      for (const m of d.meals || []) meals.set(m.idMeal, m);
    } catch (e) {
      console.warn(`${letter}: ${e.message}`);
    }
    await sleep(300);
  }
  console.log(`Iš viso receptų TheMealDB: ${meals.size}`);
  const recipes = [];
  const skipped = {};
  for (const m of meals.values()) {
    const r = convert(m);
    if (r.recipe) recipes.push(r.recipe);
    else skipped[r.skip.split(' ')[0]] = (skipped[r.skip.split(' ')[0]] || 0) + 1;
  }
  recipes.sort((a, b) => b.coverage - a.coverage || a.name_en.localeCompare(b.name_en));
  console.log(`Tinkami: ${recipes.length}; praleisti:`, skipped);
  for (const r of recipes) console.log(`${r.coverage}% ${r.id} ${r.name_en} [${r.category}] ${r.kcal} kcal${r.other.length ? ` | be: ${r.other.join(', ')}` : ''}`);
  await fs.writeFile(outFile, JSON.stringify({ updatedAt: new Date().toISOString(), recipes }, null, 1) + '\n');
}

main();

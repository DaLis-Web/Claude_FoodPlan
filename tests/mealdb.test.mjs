import test from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS } from '../js/data.js';
import { EN_MAP, convertMeasure } from '../scripts/mealdb-map.mjs';

test('TheMealDB kiekių perskaičiavimas', () => {
  assert.equal(convertMeasure('500g', INGREDIENTS.malta_mesa, 'malta_mesa'), 500);
  assert.equal(convertMeasure('2 tbsp', INGREDIENTS.aliejus, 'aliejus'), 30);
  assert.equal(convertMeasure('1 1/2 cups', INGREDIENTS.pienas, 'pienas'), 360);
  assert.equal(convertMeasure('2 large', INGREDIENTS.svogunai, 'svogunai'), 390);
  assert.equal(convertMeasure('3', INGREDIENTS.kiausiniai, 'kiausiniai'), 3);
  assert.equal(convertMeasure('1 lb', INGREDIENTS.kiauliena, 'kiauliena'), 454);
});

test('visi susiejimai rodo į egzistuojančius produktus', () => {
  for (const [en, id] of Object.entries(EN_MAP)) assert.ok(INGREDIENTS[id], `${en} → ${id}`);
});

test('neapibrėžtas kiekis – žiupsnelis', () => {
  assert.equal(convertMeasure('To taste', INGREDIENTS.druska, 'druska'), 2);
  assert.equal(convertMeasure('Drizzle', INGREDIENTS.aliejus, 'aliejus'), 10);
});

test('papildomi receptai: produktai egzistuoja, lietuviški pavadinimai, žingsniai', async () => {
  const fs = await import('node:fs/promises');
  const { recipes } = JSON.parse(await fs.readFile(new URL('../data/extra-recipes.json', import.meta.url), 'utf8'));
  assert.ok(recipes.length >= 30);
  for (const r of recipes) {
    for (const id of Object.keys(r.ing)) assert.ok(INGREDIENTS[id], `${r.id}: ${id}`);
    assert.ok(r.name && r.steps.length >= 3 && r.time > 0, r.id);
    assert.ok(r.kcal > 150 && r.kcal < 1000, `${r.id} kcal ${r.kcal}`);
  }
});

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

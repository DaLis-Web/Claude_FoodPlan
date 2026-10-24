import test from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS } from '../js/data.js';

// Atkartojame idFromLabel logiką (js/app.js), kad apsaugotume produkto paiešką.
const ingLabel = (i) => `${i.name} (${i.unit === 'g' ? 'g' : i.unit === 'ml' ? 'ml' : 'vnt'})`;
function idFromLabel(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return '';
  for (const i of Object.values(INGREDIENTS)) if (ingLabel(i).toLowerCase() === t) return i.id;
  for (const i of Object.values(INGREDIENTS)) if (i.name.toLowerCase() === t) return i.id;
  const m = Object.values(INGREDIENTS).find((i) => i.name.toLowerCase().startsWith(t)) ||
    Object.values(INGREDIENTS).find((i) => i.name.toLowerCase().includes(t));
  return m ? m.id : '';
}

test('produkto paieška pagal pilną etiketę, pavadinimą ir dalį', () => {
  assert.equal(idFromLabel('Tunas savose sultyse (g)'), 'tunas');
  assert.equal(idFromLabel('tunas'), 'tunas');
  assert.equal(idFromLabel('pien'), 'pienas');
  assert.equal(idFromLabel('lazanij'), 'lazanijos_lakstai');
  assert.equal(idFromLabel('xyz nėra'), '');
  assert.equal(idFromLabel(''), '');
});

test('etiketės unikalios (datalist nesupainios)', () => {
  const labels = Object.values(INGREDIENTS).map(ingLabel);
  assert.equal(new Set(labels).size, labels.length);
});

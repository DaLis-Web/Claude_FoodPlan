import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, matchReceiptLine } from '../js/receipt.js';

// Tekstas, kurį Tesseract atpažino iš sugeneruoto Rimi čekio vaizdo (be kai kurių nosinių – kaip realybėje).
const OCR = `UAB "RIMI LIETUVA"
Rimi Žirmūnai, Žirmūnų g. 64
PVM kodas LT100003391
Kasos Nr. 4 Kvito Nr. 2231
2026-10-21 18:42
PIENAS RIMI SMART 2,54 1L 0,58 A
BULVĖS GALA 1KG 0,72 A
KIAUL.FARŠAS 350G 1,29 A
SVIESTAS RIMI 82% 180G 0,95 A
KIAUŠINIAI M 10VNT 2,39 A
MORKOS PLAUTOS KG 0,35 A
GRIETINE 30% 400G 1,55 A
ALUS SVYTURYS 0,5L 1,19 A
TAUPYK KORTELE NUOLAIDA -0,20
IŠ VISO MOKETI: 8,82
Mokėta kortele 8,82
PVM 21% 1,53`;

test('čekis: parduotuvė, data, suma, nuolaida', () => {
  const r = parseReceipt(OCR);
  assert.equal(r.store, 'rimi');
  assert.equal(r.date, '2026-10-21');
  assert.equal(r.total, 8.82);
  assert.equal(r.discount, 0.2);
  assert.equal(r.items.length, 8);
});

test('čekis: prekės susiejamos su produktais ir kiekiais', () => {
  const r = parseReceipt(OCR);
  const by = Object.fromEntries(r.items.map((i) => [i.ingId, i]));
  assert.deepEqual(r.items.map((i) => i.ingId), ['pienas', 'bulves', 'malta_mesa', 'sviestas', 'kiausiniai', 'morkos', 'grietine', 'alus']);
  assert.equal(by.pienas.qty, 1000);
  assert.equal(by.malta_mesa.qty, 350);
  assert.equal(by.kiausiniai.qty, 10);
  assert.equal(by.sviestas.qty, 180);
});

test('čekis: kiekis „2 x“ ir neatpažintos eilutės', () => {
  const r = parseReceipt('MAXIMA LT\nJOGURTAS NATŪRALUS 400G 2 X 0,89 1,78\nTUALETINIS POPIERIUS 8 VNT 2,99\nIš viso 4,77');
  assert.equal(r.store, 'maxima');
  assert.equal(r.items[0].ingId, 'jogurtas');
  assert.equal(r.items[0].count, 2);
  assert.equal(r.items[0].qty, 800);
  assert.equal(r.items[1].ingId, null);
  assert.equal(r.total, 4.77);
});

test('trumpiniai be nosinių', () => {
  assert.equal(matchReceiptLine('KIAUL. SPRANDINE BE KAULO'), 'kiauliena');
  assert.equal(matchReceiptLine('VISTIENOS KRUTINELES FILE'), 'vistienos_file');
  assert.equal(matchReceiptLine('KATEMS EDALAS LASISA'), null);
});

test('Maxima el. čekis iš laiško (Gmail tekstas, kelių eilučių pavadinimai, svoriai, nuolaidos)', async () => {
  const fs = await import('node:fs/promises');
  const r = parseReceipt(await fs.readFile(new URL('./fixtures/maxima-email.txt', import.meta.url), 'utf8'));
  assert.equal(r.store, 'maxima');
  assert.equal(r.date, '2026-10-23');
  assert.equal(r.total, 157.5);
  const by = Object.fromEntries(r.items.filter((i) => i.ingId).map((i) => [i.ingId, i]));
  assert.equal(by.svogunai.qty, 374); // „0,48 X 0,374 kg“
  assert.equal(by.bulves.qty, 2544);
  assert.equal(by.bulves.price, 2.52); // 2,93 − 0,41 nuolaida
  assert.equal(by.varske.qty, 800); // 2 pak. po 400 g
  assert.equal(by.alus.count, 2); // depozito „8 vnt.“ nepriskiriama alui
  assert.equal(by.mocarela.name.includes('MOZZARELLA'), true);
  assert.ok(by.koldunai && by.duona && by.tunas && by.morkos && by.vistienos_file && by.lazanijos_lakstai);
  assert.ok(by.vistienos_file.qty > 500 && by.vistienos_file.qty < 900); // įvertinta iš kainos
  // ne maistas – neatpažįstama
  for (const n of ['LED lemputė', 'Šunų ėdalas', 'pirkinių maišas']) {
    assert.equal(r.items.find((i) => i.name.includes(n))?.ingId ?? null, null, n);
  }
  assert.ok(!r.items.some((i) => /depozit/i.test(i.name)));
});

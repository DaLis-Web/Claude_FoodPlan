import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../js/store.js';
import { INGREDIENTS, RECIPES } from '../js/data.js';
import {
  makeCtx, generatePlan, shoppingList, storeTotals, evaluatePlan, alternativesFor,
  consumeFromPantry, isVegetarian, mondayOf, SLOTS,
} from '../js/planner.js';

const WEEK = '2026-10-26';

function ctxWith(mod = {}) {
  const state = defaultState();
  Object.assign(state.settings, mod.settings || {});
  if (mod.pantry) state.pantry = mod.pantry;
  return { state, ctx: makeCtx(state) };
}

test('visi receptų ingredientai egzistuoja', () => {
  for (const r of RECIPES) {
    for (const id of Object.keys(r.ing)) assert.ok(INGREDIENTS[id], `${r.id}: nėra ${id}`);
  }
});

test('mondayOf grąžina pirmadienį', () => {
  assert.equal(mondayOf(new Date(2026, 9, 25)), '2026-10-19'); // sekmadienis
  assert.equal(mondayOf(new Date(2026, 9, 26)), '2026-10-26');
});

test('sugeneruojamas pilnas savaitės planas', () => {
  const { ctx } = ctxWith();
  const plan = generatePlan(ctx, { weekStart: WEEK, todayIso: WEEK, seed: 1, runs: 40 });
  for (const day of plan.days) for (const s of SLOTS) assert.ok(day[s]?.recipeId, 'tuščias patiekalas');
  // tas pats receptas nekartojamas iš eilės (išskyrus likučius)
  for (let d = 1; d < 7; d++) {
    assert.notEqual(plan.days[d].vakariene.recipeId, plan.days[d - 1].vakariene.recipeId);
  }
});

test('likučiai: vakarienė dviguba, kitos dienos pietūs be pirkinių', () => {
  const { ctx } = ctxWith({ settings: { leftovers: true, people: 3 } });
  const plan = generatePlan(ctx, { weekStart: WEEK, seed: 2, runs: 10 });
  for (let d = 1; d < 7; d++) {
    const lunch = plan.days[d].pietus;
    assert.ok(lunch.leftover);
    assert.equal(lunch.recipeId, plan.days[d - 1].vakariene.recipeId);
    assert.equal(plan.days[d - 1].vakariene.extra, 3);
  }
});

test('vegetariškas planas neturi mėsos', () => {
  const { ctx } = ctxWith({ settings: { vegetarian: true } });
  const plan = generatePlan(ctx, { weekStart: WEEK, seed: 3, runs: 20 });
  for (const day of plan.days) for (const s of SLOTS) assert.ok(isVegetarian(ctx.recipes[day[s].recipeId]));
});

test('užrakintas patiekalas išlieka', () => {
  const { ctx } = ctxWith();
  const first = generatePlan(ctx, { weekStart: WEEK, seed: 4, runs: 10 });
  first.days[2].vakariene = { recipeId: 'plovas', servings: 2, locked: true };
  const second = generatePlan(ctx, { existing: first, weekStart: WEEK, seed: 5, runs: 10 });
  assert.equal(second.days[2].vakariene.recipeId, 'plovas');
  assert.ok(second.days[2].vakariene.locked);
});

test('pirkinių sąrašas apvalina iki pakuočių ir atima sandėliuką', () => {
  const plan = { days: Array.from({ length: 7 }, () => ({})) };
  plan.days[0].vakariene = { recipeId: 'bolonese', servings: 2 };
  const { ctx } = ctxWith({ pantry: [{ id: 'x', ingId: 'makaronai', qty: 500, expiry: '2027-01-01' }] });
  const items = shoppingList(plan, ctx, { todayIso: WEEK });
  const mak = items.find((i) => i.ingId === 'makaronai');
  assert.equal(mak.packs, 0);
  const mesa = items.find((i) => i.ingId === 'malta_mesa');
  assert.equal(mesa.need, 250);
  assert.equal(mesa.packs, 1);
  const t = storeTotals(items, ctx);
  assert.ok(t.totals[t.cheapest] <= Math.min(...Object.values(t.totals)) + 1e-9);
  assert.ok(t.bestPair.total <= t.totals[t.cheapest] + 1e-9);
});

test('daugiau bandymų duoda ne prastesnį plano įvertinimą', () => {
  const { ctx } = ctxWith({ settings: { leftovers: false } });
  const best = evaluatePlan(generatePlan(ctx, { weekStart: WEEK, seed: 6, runs: 60 }), ctx);
  const naive = evaluatePlan(generatePlan(ctx, { weekStart: WEEK, seed: 6, runs: 1 }), ctx);
  assert.ok(best.score <= naive.score + 1e-9, `${best.score} > ${naive.score}`);
  assert.ok(best.cost <= ctx.settings.budget, 'viršytas biudžetas');
});

test('alternatyvos surikiuotos pagal papildomą kainą', () => {
  const { ctx } = ctxWith();
  const plan = generatePlan(ctx, { weekStart: WEEK, seed: 7, runs: 5 });
  const alts = alternativesFor(plan, 3, 'vakariene', ctx);
  assert.ok(alts.length > 5);
  for (let i = 1; i < alts.length; i++) assert.ok(alts[i].extraCost >= alts[i - 1].extraCost);
});

test('pagaminus patiekalą produktai nurašomi iš sandėliuko', () => {
  const pantry = [
    { id: 'a', ingId: 'bulves', qty: 1000, expiry: '2026-11-10' },
    { id: 'b', ingId: 'bulves', qty: 300, expiry: '2026-10-28' },
  ];
  const r = RECIPES.find((x) => x.id === 'bulviniai_blynai');
  const next = consumeFromPantry(pantry, r, 2); // 600 g
  assert.equal(next.find((p) => p.id === 'b'), undefined);
  assert.equal(next.find((p) => p.id === 'a').qty, 700);
});

test('norai atpažįstami iš laisvo teksto (be raidžių su nosinėmis, su linksniais)', async () => {
  const { matchWishes } = await import('../js/planner.js');
  const { ctx } = ctxWith();
  const res = matchWishes('Noriu šią savaitę kugelio, cepelinu ir zemaiciu blynu; pizza', ctx.recipes);
  assert.deepEqual(res.matched.map((m) => m.recipe.id), ['kugelis', 'cepelinai', 'zemaiciu_blynai']);
  assert.deepEqual(res.unmatched, ['pizza']);
});

test('norimi patiekalai įtraukiami, ilgi – savaitgalį; pasiūlymai dera', async () => {
  const { complementSuggestions } = await import('../js/planner.js');
  const { ctx } = ctxWith({ settings: { maxWeekdayTime: 45 } });
  const plan = generatePlan(ctx, { weekStart: WEEK, wishes: ['kugelis', 'cepelinai'], seed: 9, runs: 30 });
  const where = {};
  plan.days.forEach((day, d) => SLOTS.forEach((s) => { if (day[s]?.wish) where[day[s].recipeId] = d; }));
  assert.ok(where.kugelis >= 5 && where.cepelinai >= 5, JSON.stringify(where));
  const sug = complementSuggestions(['kugelis', 'cepelinai'], ctx);
  assert.ok(sug.length > 0);
  assert.ok(sug.every((x) => x.shared.length > 0 && x.saving > 0));
});

test('gėrimai įskaičiuojami į kiekvienos parduotuvės sumą', async () => {
  const { extraPrices } = await import('../js/planner.js');
  const { ctx } = ctxWith();
  const extras = [{ id: 'a', ingId: 'alus', qty: 6 }, { id: 'b', name: 'Servetėlės', price: 1.5 }];
  const t = storeTotals([], ctx, extras);
  for (const s of ctx.stores) {
    assert.ok(Math.abs(t.totals[s] - (6 * ctx.priceOf('alus', s) + 1.5)) < 1e-9);
  }
  assert.equal(extraPrices(extras[0], ctx).lidl, 6 * ctx.priceOf('alus', 'lidl'));
  assert.equal(t.bestPair.assign['extra:a'] !== undefined, true);
});

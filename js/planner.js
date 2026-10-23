// Gryna planavimo logika: nepriklauso nuo DOM, todėl testuojama su `node --test`.
import { INGREDIENTS, RECIPES, STORES, defaultPrice } from './data.js';

export const SLOTS = ['pusryciai', 'pietus', 'vakariene'];
export const SLOT_LABELS = { pusryciai: 'Pusryčiai', pietus: 'Pietūs', vakariene: 'Vakarienė' };
export const DAY_NAMES = ['Pirmadienis', 'Antradienis', 'Trečiadienis', 'Ketvirtadienis', 'Penktadienis', 'Šeštadienis', 'Sekmadienis'];

const DAY_MS = 86400000;
const PERISHABLE_DAYS = 14;

// ---------- Datos ----------

export function toISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function mondayOf(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = pirmadienis
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / DAY_MS);
}

// ---------- Kontekstas ----------

export function isVegetarian(recipe) {
  return Object.keys(recipe.ing).every((id) => INGREDIENTS[id]?.cat !== 'mesa');
}

// Papildomi receptai (importuoti iš TheMealDB, data/extra-recipes.json) – užkraunami programėlės paleidimo metu.
let EXTRA_RECIPES = [];
export function setExtraRecipes(list) {
  EXTRA_RECIPES = Array.isArray(list) ? list : [];
}

export function allRecipes(state) {
  return [...RECIPES, ...EXTRA_RECIPES, ...(state.customRecipes || [])];
}

// Gyvos kainos laikomos aktualiomis tiek dienų nuo atnaujinimo.
export const LIVE_MAX_AGE_DAYS = 8;

// Pakuotės kaina iš parduotuvės duomenų: pirmenybė vieneto kainai (€/kg, €/l, €/vnt.).
export function livePackPrice(ing, row) {
  if (!row) return null;
  if (row.unitPrice > 0) {
    if ((ing.unit === 'g' && row.unit === 'kg') || (ing.unit === 'ml' && row.unit === 'l')) {
      return Math.round(row.unitPrice * (ing.pack / 1000) * 100) / 100;
    }
    if (ing.unit === 'vnt' && row.unit === 'vnt') return Math.round(row.unitPrice * ing.pack * 100) / 100;
  }
  return row.price > 0 ? row.price : null;
}

function activePromo(promos, ingId, storeId, todayIso) {
  return (promos || []).find(
    (p) => p.ingId === ingId && p.store === storeId && (!p.until || !todayIso || p.until >= todayIso),
  );
}

/**
 * Prekės kaina konkrečioje parduotuvėje ir jos šaltinis.
 * Pirmenybė: rankinis kainos pakeitimas > rankiniu būdu įvesta akcija > automatiškai surinkta kaina > apytikslė.
 */
export function priceInfo(ingId, storeId, { overrides = {}, promos = [], live = null, todayIso = null } = {}) {
  const o = overrides[`${ingId}|${storeId}`];
  if (typeof o === 'number') return { price: o, source: 'manual' };
  const promo = activePromo(promos, ingId, storeId, todayIso);
  if (promo) {
    return { price: promo.packPrice, source: 'promo', promo: true, oldPrice: promo.oldPrice || null, until: promo.until, note: promo.note };
  }
  const ing = INGREDIENTS[ingId];
  const updated = live?.sources?.[storeId]?.updatedAt || live?.updatedAt;
  const fresh = updated && (!todayIso || daysBetween(updated.slice(0, 10), todayIso) <= LIVE_MAX_AGE_DAYS);
  const row = fresh ? live.stores?.[storeId]?.[ingId] : null;
  const lp = ing && livePackPrice(ing, row);
  if (lp) {
    const ratio = row.oldPrice && row.price ? row.oldPrice / row.price : null;
    return {
      price: lp,
      source: 'live',
      promo: !!row.promo,
      oldPrice: ratio ? Math.round(lp * ratio * 100) / 100 : null,
      until: row.validUntil || null,
      title: row.title,
      url: row.url,
    };
  }
  return { price: defaultPrice(ingId, storeId), source: 'estimate' };
}

export function makeCtx(state, live = null, todayIso = toISO(new Date())) {
  const settings = state.settings;
  const stores = settings.stores?.length ? settings.stores : STORES.map((s) => s.id);
  const priceOpts = { overrides: state.priceOverrides || {}, promos: state.promos || [], live, todayIso };
  const infoCache = {};
  const infoOf = (ingId, storeId) => {
    const k = `${ingId}|${storeId}`;
    return infoCache[k] || (infoCache[k] = priceInfo(ingId, storeId, priceOpts));
  };
  const priceOf = (ingId, storeId) => infoOf(ingId, storeId).price;
  const minPrice = {};
  for (const id of Object.keys(INGREDIENTS)) {
    minPrice[id] = Math.min(...stores.map((s) => priceOf(id, s)));
  }
  const recipes = {};
  for (const r of allRecipes(state)) recipes[r.id] = r;
  return {
    settings,
    stores,
    priceOf,
    infoOf,
    minPrice,
    recipes,
    pantry: state.pantry || [],
    favorites: new Set(state.favorites || []),
    disliked: new Set(state.disliked || []),
  };
}

export function recipeServingCost(recipe, ctx) {
  let sum = 0;
  for (const [id, qty] of Object.entries(recipe.ing)) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    sum += (qty / ing.pack) * ctx.minPrice[id];
  }
  return sum;
}

// ---------- Plano struktūra ----------

export function emptyPlan() {
  return { days: Array.from({ length: 7 }, () => ({})) };
}

// Kiek porcijų reikia pagaminti šiam įrašui (įskaitant likučius kitai dienai).
function entryServings(entry) {
  return (entry.servings || 0) + (entry.extra || 0);
}

export function needsOf(plan, ctx, { excludeSlot } = {}) {
  const needs = {};
  plan.days.forEach((day, d) => {
    for (const s of SLOTS) {
      const e = day[s];
      if (!e || e.skip || e.leftover || e.cooked || !e.recipeId) continue;
      if (excludeSlot && excludeSlot[0] === d && excludeSlot[1] === s) continue;
      const r = ctx.recipes[e.recipeId];
      if (!r) continue;
      const n = entryServings(e);
      for (const [id, qty] of Object.entries(r.ing)) needs[id] = (needs[id] || 0) + qty * n;
    }
  });
  return needs;
}

export function pantryStock(pantry, todayIso) {
  const stock = {};
  for (const p of pantry) {
    if (p.expiry && todayIso && p.expiry < todayIso) continue;
    stock[p.ingId] = (stock[p.ingId] || 0) + p.qty;
  }
  return stock;
}

// Produktai, kurių galiojimas baigiasi per `days` dienų nuo `fromIso`.
export function expiringStock(pantry, fromIso, days = 5) {
  const out = {};
  for (const p of pantry) {
    if (!p.expiry) continue;
    const left = daysBetween(fromIso, p.expiry);
    if (left >= 0 && left <= days) out[p.ingId] = (out[p.ingId] || 0) + p.qty;
  }
  return out;
}

// ---------- Pirkinių sąrašas ----------

export function shoppingList(plan, ctx, { todayIso } = {}) {
  const needs = needsOf(plan, ctx);
  const stock = pantryStock(ctx.pantry, todayIso);
  const items = [];
  for (const [id, need] of Object.entries(needs)) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    const have = stock[id] || 0;
    const toBuy = Math.max(0, need - have);
    const staple = ing.staple && ctx.settings.assumeStaples;
    const packs = toBuy > 1e-6 ? Math.ceil(toBuy / ing.pack - 1e-9) : 0;
    const prices = {};
    for (const s of ctx.stores) prices[s] = packs * ctx.priceOf(id, s);
    const promoStores = ctx.infoOf ? ctx.stores.filter((s) => ctx.infoOf(id, s).promo) : [];
    items.push({
      ingId: id,
      promoStores,
      name: ing.name,
      cat: ing.cat,
      unit: ing.unit,
      pack: ing.pack,
      need,
      have,
      toBuy,
      packs,
      surplus: packs * ing.pack - toBuy,
      staple,
      prices,
      minPrice: packs * ctx.minPrice[id],
    });
  }
  items.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name, 'lt'));
  return items;
}

/**
 * Papildomos prekės (gėrimai ir pan.): katalogo prekės `{ ingId, qty }` įkainojamos kiekvienoje parduotuvėje,
 * laisvo teksto prekės `{ name, price }` turi vieną kainą.
 */
export function extraPrices(extra, ctx) {
  const prices = {};
  for (const s of ctx.stores) {
    prices[s] = extra.ingId && INGREDIENTS[extra.ingId] ? (extra.qty || 1) * ctx.priceOf(extra.ingId, s) : extra.price || 0;
  }
  return prices;
}

export function storeTotals(items, ctx, extras = []) {
  const buy = [
    ...items.filter((i) => i.packs > 0 && !i.staple),
    ...extras.filter((x) => x.ingId).map((x) => ({ ingId: `extra:${x.id}`, prices: extraPrices(x, ctx) })),
  ];
  const totals = {};
  for (const s of ctx.stores) totals[s] = buy.reduce((sum, i) => sum + i.prices[s], 0);
  const extraSum = extras.filter((x) => !x.ingId).reduce((sum, x) => sum + (x.price || 0), 0);
  for (const s of ctx.stores) totals[s] += extraSum;

  const ranked = [...ctx.stores].sort((a, b) => totals[a] - totals[b]);

  // Geriausias dviejų parduotuvių derinys: kiekvieną prekę perkame ten, kur pigiau.
  let bestPair = null;
  for (let i = 0; i < ctx.stores.length; i++) {
    for (let j = i + 1; j < ctx.stores.length; j++) {
      const a = ctx.stores[i];
      const b = ctx.stores[j];
      let total = extraSum;
      const assign = {};
      for (const it of buy) {
        const pick = it.prices[a] <= it.prices[b] ? a : b;
        assign[it.ingId] = pick;
        total += it.prices[pick];
      }
      if (!bestPair || total < bestPair.total) bestPair = { stores: [a, b], total, assign };
    }
  }
  return { totals, ranked, cheapest: ranked[0], bestPair };
}

// ---------- Plano įvertinimas ----------

export function evaluatePlan(plan, ctx, { weekStart, todayIso } = {}) {
  const items = shoppingList(plan, ctx, { todayIso });
  let cost = 0;
  let waste = 0;
  for (const it of items) {
    if (it.staple) continue;
    cost += it.minPrice;
    const ing = INGREDIENTS[it.ingId];
    if (ing.shelf < PERISHABLE_DAYS && it.packs > 0) {
      waste += (it.surplus / ing.pack) * ctx.minPrice[it.ingId];
    }
  }

  // Įvairovė: tas pats receptas dažnai ar iš eilės – bauda.
  let variety = 0;
  const counts = {};
  const lastDay = {};
  plan.days.forEach((day, d) => {
    for (const s of SLOTS) {
      const e = day[s];
      if (!e || !e.recipeId || e.leftover || e.skip) continue;
      counts[e.recipeId] = (counts[e.recipeId] || 0) + 1;
      if (lastDay[e.recipeId] !== undefined && d - lastDay[e.recipeId] <= 1) variety += 2;
      lastDay[e.recipeId] = d;
    }
  });
  for (const [id, c] of Object.entries(counts)) {
    const isMain = ctx.recipes[id] && !ctx.recipes[id].meals.includes('pusryciai');
    if (c > 1) variety += (c - 1) * (isMain ? 6 : 1.5);
  }

  // Nauda už besibaigiančių produktų sunaudojimą.
  let rescued = 0;
  if (weekStart) {
    const expiring = expiringStock(ctx.pantry, todayIso || weekStart, 5);
    const needs = needsOf(plan, ctx);
    for (const [id, qty] of Object.entries(expiring)) {
      const used = Math.min(qty, needs[id] || 0);
      if (used > 0) rescued += (used / INGREDIENTS[id].pack) * ctx.minPrice[id];
    }
  }

  const people = Math.max(1, ctx.settings.people || 1);
  const budget = ctx.settings.budget || 0;
  const overBudget = budget > 0 ? Math.max(0, cost - budget) : 0;
  let kcal = 0;
  let protein = 0;
  let nutrition = 0;
  let cookedMeals = 0;
  plan.days.forEach((day) => {
    for (const s of SLOTS) {
      const e = day[s];
      if (!e || e.skip || !e.recipeId) continue;
      const r = ctx.recipes[e.recipeId];
      if (!r) continue;
      kcal += r.kcal || 0;
      protein += r.protein || 0;
      nutrition += nutritionBonus(r, people);
      cookedMeals++;
    }
  });

  // Kol telpame į biudžetą, kaina svarbi mažiau nei įvairovė ir mityba.
  const score = cost * 0.6 + overBudget * 3 + waste * 1.5 + variety * people * 0.6 - nutrition - rescued * 1.5;

  return { cost, waste, rescued, variety, score, items, kcalPerDay: kcal / 7, proteinPerDay: protein / 7, meals: cookedMeals };
}

// ---------- Generavimas ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function candidatesFor(slot, dayIndex, ctx, { relaxTime = false } = {}) {
  const st = ctx.settings;
  const excluded = new Set(st.excluded || []);
  return Object.values(ctx.recipes).filter((r) => {
    if (!r.meals.includes(slot)) return false;
    if (ctx.disliked.has(r.id)) return false;
    if (st.vegetarian && !isVegetarian(r)) return false;
    if (Object.keys(r.ing).some((id) => excluded.has(id))) return false;
    if (!relaxTime && dayIndex < 5 && st.maxWeekdayTime && r.time > st.maxWeekdayTime) return false;
    return true;
  });
}

// Papildoma kaina, kurią sukels receptas, atsižvelgiant į jau suplanuotus produktus ir sandėliuką.
export function marginalCost(recipe, servings, needs, stock, ctx) {
  let delta = 0;
  for (const [id, qty] of Object.entries(recipe.ing)) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    if (ing.staple && ctx.settings.assumeStaples) continue;
    const have = stock[id] || 0;
    const before = Math.max(0, (needs[id] || 0) - have);
    const after = Math.max(0, (needs[id] || 0) + qty * servings - have);
    const pb = before > 1e-6 ? Math.ceil(before / ing.pack - 1e-9) : 0;
    const pa = after > 1e-6 ? Math.ceil(after / ing.pack - 1e-9) : 0;
    delta += (pa - pb) * ctx.minPrice[id];
  }
  return delta;
}

function addNeeds(needs, recipe, servings) {
  for (const [id, qty] of Object.entries(recipe.ing)) needs[id] = (needs[id] || 0) + qty * servings;
}

// Mityba: baltymingi patiekalai šiek tiek skatinami (sveikesnis ir sotesnis meniu).
function nutritionBonus(recipe, people) {
  return Math.max(-10, Math.min(15, (recipe.protein || 0) - 20)) * 0.04 * people;
}

function slotScore(recipe, d, servings, plan, needs, stock, expiring, ctx, usage) {
  let score = marginalCost(recipe, servings, needs, stock, ctx) * 0.6;
  const people = Math.max(1, ctx.settings.people || 1);
  const isMain = !recipe.meals.includes('pusryciai');
  const u = usage[recipe.id];
  if (u) {
    score += (isMain ? 4 : 1) * people * u.count;
    if (d - u.last <= 1) score += 3 * people;
  }
  score -= nutritionBonus(recipe, people);
  if (ctx.favorites.has(recipe.id)) score -= 0.6 * people;
  for (const id of Object.keys(recipe.ing)) {
    if (expiring[id] > (needs[id] || 0)) score -= 1.2 * people;
  }
  return score;
}

/**
 * Sugeneruoja savaitės planą. Išsaugo užrakintus, praleistus ir pagamintus patiekalus,
 * įtraukia norimus (`wishes` – receptų id).
 * Vykdo kelis atsitiktinius „godžius“ bandymus ir grąžina geriausią pagal kainą, švaistymą ir įvairovę.
 */
export function generatePlan(ctx, { existing, weekStart, todayIso, wishes = [], runs = 120, seed = Date.now() } = {}) {
  const rng = mulberry32(seed);
  const st = ctx.settings;
  const people = Math.max(1, st.people || 1);
  const slots = SLOTS.filter((s) => (st.meals || SLOTS).includes(s));
  const stock = pantryStock(ctx.pantry, todayIso);
  const expiring = expiringStock(ctx.pantry, todayIso || weekStart || toISO(new Date()), 5);
  const base = existing || emptyPlan();

  const isKept = (e, d) => {
    if (!e || !(e.locked || e.skip || e.cooked)) return false;
    if (e.leftover) {
      // Likučiai prasmingi tik jei vakarykštė vakarienė irgi išsaugoma.
      const prev = d > 0 ? base.days[d - 1].vakariene : null;
      return !!(prev && prev.recipeId === e.recipeId && (prev.locked || prev.cooked));
    }
    return true;
  };

  let best = null;
  for (let run = 0; run < runs; run++) {
    const plan = emptyPlan();
    const usage = {};
    const needs = {};
    const noise = run === 0 ? 0 : 0.25 + rng() * 0.5;

    // Pirmiausia įtraukiame išsaugotus įrašus, kad jų produktai būtų įvertinti.
    base.days.forEach((day, d) => {
      for (const s of SLOTS) {
        const e = day[s];
        if (!isKept(e, d)) continue;
        plan.days[d][s] = { ...e };
        if (s === 'vakariene' && e.extra && !(d < 6 && isKept(base.days[d + 1].pietus, d + 1))) {
          delete plan.days[d][s].extra;
        }
        if (e.recipeId && !e.skip && !e.leftover && !e.cooked && ctx.recipes[e.recipeId]) {
          addNeeds(needs, ctx.recipes[e.recipeId], entryServings(plan.days[d][s]));
        }
        if (e.recipeId && !e.skip) {
          usage[e.recipeId] = { count: (usage[e.recipeId]?.count || 0) + 1, last: d };
        }
      }
    });

    // Norimi patiekalai dedami pirmi, o likę parenkami taip, kad sunaudotų tuos pačius produktus.
    placeWishes(plan, wishes, ctx, slots, rng, needs, usage);

    for (let d = 0; d < 7; d++) {
      for (const s of slots) {
        if (plan.days[d][s]) continue;

        // Likučiai: vakar vakarienės dvigubą porciją valgome šiandien per pietus.
        if (st.leftovers && s === 'pietus' && d > 0 && slots.includes('vakariene')) {
          const prev = plan.days[d - 1].vakariene;
          if (prev && prev.recipeId && !prev.skip && !prev.leftover && !prev.cooked) {
            const r = ctx.recipes[prev.recipeId];
            prev.extra = people;
            addNeeds(needs, r, people);
            plan.days[d][s] = { recipeId: prev.recipeId, leftover: true, servings: people };
            continue;
          }
        }

        let cands = candidatesFor(s, d, ctx);
        if (!cands.length) cands = candidatesFor(s, d, ctx, { relaxTime: true });
        if (!cands.length) continue;

        let pick = null;
        let pickScore = Infinity;
        for (const r of cands) {
          let sc = slotScore(r, d, people, plan, needs, stock, expiring, ctx, usage);
          sc += noise * (rng() * 4 - 1) * people;
          if (sc < pickScore) {
            pickScore = sc;
            pick = r;
          }
        }
        plan.days[d][s] = { recipeId: pick.id, servings: people };
        addNeeds(needs, pick, people);
        usage[pick.id] = { count: (usage[pick.id]?.count || 0) + 1, last: d };
      }
    }

    const ev = evaluatePlan(plan, ctx, { weekStart, todayIso });
    if (!best || ev.score < best.ev.score) best = { plan, ev };
  }
  return best.plan;
}

// Alternatyvos vienam patiekalui, surikiuotos pagal papildomą kainą.
export function alternativesFor(plan, d, slot, ctx, { todayIso } = {}) {
  const people = Math.max(1, ctx.settings.people || 1);
  const current = plan.days[d][slot];
  const servings = current ? current.servings || people : people;
  const needs = needsOf(plan, ctx, { excludeSlot: [d, slot] });
  const stock = pantryStock(ctx.pantry, todayIso);
  let cands = candidatesFor(slot, d, ctx, { relaxTime: true });
  return cands
    .map((r) => ({ recipe: r, extraCost: marginalCost(r, servings + (current?.extra || 0), needs, stock, ctx) }))
    .sort((a, b) => a.extraCost - b.extraCost);
}

// Kiek receptų ingredientų (pagal vertę) jau yra sandėliuke.
export function pantryCoverage(recipe, ctx, people, todayIso) {
  const stock = pantryStock(ctx.pantry, todayIso);
  let total = 0;
  let covered = 0;
  for (const [id, qty] of Object.entries(recipe.ing)) {
    const ing = INGREDIENTS[id];
    if (!ing || (ing.staple && ctx.settings.assumeStaples)) continue;
    const need = qty * people;
    const value = (need / ing.pack) * ctx.minPrice[id];
    total += value;
    covered += value * Math.min(1, (stock[id] || 0) / need);
  }
  return total > 0 ? covered / total : 1;
}

// Nurašo pagaminto patiekalo produktus iš sandėliuko (pirmiausia artimiausio galiojimo).
export function consumeFromPantry(pantry, recipe, servings) {
  const next = pantry.map((p) => ({ ...p }));
  for (const [id, qty] of Object.entries(recipe.ing)) {
    let left = qty * servings;
    const rows = next.filter((p) => p.ingId === id).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
    for (const row of rows) {
      if (left <= 0) break;
      const take = Math.min(row.qty, left);
      row.qty -= take;
      left -= take;
    }
  }
  return next.filter((p) => p.qty > 1e-6);
}

// Visos šiuo metu žinomos akcijos pasirinktose parduotuvėse.
export function currentPromos(ctx) {
  const out = [];
  for (const id of Object.keys(INGREDIENTS)) {
    for (const s of ctx.stores) {
      const info = ctx.infoOf(id, s);
      if (!info.promo) continue;
      const discount = info.oldPrice ? 1 - info.price / info.oldPrice : null;
      out.push({ ingId: id, store: s, ...info, discount });
    }
  }
  return out.sort((a, b) => (b.discount || 0) - (a.discount || 0));
}

// ---------- Norai: „noriu šią savaitę kugelio, cepelinų“ ----------

const STOP_WORDS = new Set(['su', 'ir', 'ar', 'be', 'bei', 'noriu', 'norime', 'norėčiau', 'valgyti', 'pavalgyti', 'šią', 'sia', 'savaitę', 'savaite', 'kažką', 'kazka', 'nors', 'kokį', 'kokia', 'gal', 'dar', 'kartą', 'karta', 'pvz']);

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s) {
  return normalizeText(s).split(' ').filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// Lietuviškos galūnės kinta („kugelis“, „kugelio“, „kugelį“), todėl lyginame bendrą pradžią.
function sameStem(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= Math.max(4, Math.min(a.length, b.length) - 2);
}

function matchScore(tokenWords, recipe) {
  const variants = [recipe.name, ...(recipe.aliases || [])].map(words);
  let best = 0;
  for (const rw of variants) {
    let hits = 0;
    let first = false;
    for (const tw of tokenWords) {
      const idx = rw.findIndex((w) => sameStem(tw, w));
      if (idx >= 0) {
        hits++;
        if (idx === 0) first = true;
      }
    }
    if (!hits) continue;
    // Daugiau sutapusių žodžių – geriau; pirmas pavadinimo žodys – svarbiausias; trumpesnis pavadinimas – tikslesnis.
    const score = hits * 10 + (first ? 3 : 0) - rw.length * 0.2;
    if (score > best) best = score;
  }
  return best;
}

/** Iš laisvo teksto atrenka receptus. Grąžina { matched: [{ text, recipe }], unmatched: [text] }. */
export function matchWishes(text, recipes) {
  const list = Array.isArray(recipes) ? recipes : Object.values(recipes);
  const parts = String(text || '')
    .split(/[,;\n]+|\s+ir\s+|\s+bei\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const matched = [];
  const unmatched = [];
  for (const part of parts) {
    const tw = words(part);
    if (!tw.length) continue;
    let best = null;
    let bestScore = 0;
    for (const r of list) {
      const sc = matchScore(tw, r);
      if (sc > bestScore) {
        bestScore = sc;
        best = r;
      }
    }
    if (best && !matched.some((m) => m.recipe.id === best.id)) matched.push({ text: part, recipe: best });
    else if (!best) unmatched.push(part);
  }
  return { matched, unmatched };
}

function preferredSlot(recipe, slots) {
  if (recipe.meals.includes('vakariene') && slots.includes('vakariene')) return 'vakariene';
  return recipe.meals.find((m) => slots.includes(m)) || null;
}

// Išdėlioja norimus patiekalus: ilgai gaminamus – savaitgalį, kitus – tolygiai per savaitę.
function placeWishes(plan, wishIds, ctx, slots, rng, needs, usage) {
  const st = ctx.settings;
  const people = Math.max(1, st.people || 1);
  const already = new Set();
  plan.days.forEach((day) => Object.values(day).forEach((e) => e?.recipeId && already.add(e.recipeId)));
  const wishDays = [];
  for (const id of wishIds) {
    const r = ctx.recipes[id];
    if (!r || already.has(id)) continue;
    const slot = preferredSlot(r, slots);
    if (!slot) continue;
    const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !plan.days[d][slot]);
    if (!free.length) continue;
    const long = st.maxWeekdayTime && r.time > st.maxWeekdayTime;
    let best = null;
    let bestScore = -Infinity;
    for (const d of free) {
      const spread = wishDays.length ? Math.min(...wishDays.map((x) => Math.abs(x - d))) : 3;
      let score = spread + rng() * 0.8;
      if (long) score += d >= 5 ? 10 : -5;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    plan.days[best][slot] = { recipeId: id, servings: people, wish: true };
    addNeeds(needs, r, people);
    usage[id] = { count: (usage[id]?.count || 0) + 1, last: best };
    wishDays.push(best);
    already.add(id);
  }
}

/**
 * Patiekalai, kurie dera prie norimų: naudoja tuos pačius produktus (pvz. likusias bulves, grietinę),
 * todėl kainuoja mažiau. Grąžina [{ recipe, saving, shared: [ingId] }].
 */
export function complementSuggestions(wishIds, ctx, { todayIso, limit = 4 } = {}) {
  const people = Math.max(1, ctx.settings.people || 1);
  const needs = {};
  for (const id of wishIds) if (ctx.recipes[id]) addNeeds(needs, ctx.recipes[id], people);
  if (!Object.keys(needs).length) return [];
  const stock = pantryStock(ctx.pantry, todayIso);
  const wishSet = new Set(wishIds);
  const seen = new Set();
  const out = [];
  for (const slot of ['vakariene', 'pusryciai']) {
    for (const r of candidatesFor(slot, 6, ctx)) {
      if (wishSet.has(r.id) || seen.has(r.id)) continue;
      seen.add(r.id);
      const alone = marginalCost(r, people, {}, stock, ctx);
      const together = marginalCost(r, people, needs, stock, ctx);
      const shared = Object.keys(r.ing).filter((id) => needs[id] && !(INGREDIENTS[id].staple && ctx.settings.assumeStaples));
      const saving = alone - together;
      if (saving > 0.2 && shared.length) out.push({ recipe: r, saving, shared });
    }
  }
  return out.sort((a, b) => b.saving - a.saving).slice(0, limit);
}

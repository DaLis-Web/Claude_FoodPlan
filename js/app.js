import { STORES, CATEGORIES, INGREDIENTS, EXTRA_CATS } from './data.js';
import { loadState, saveState, defaultState, mergeDefaults, uid } from './store.js';
import {
  SLOTS, SLOT_LABELS, DAY_NAMES, makeCtx, generatePlan, evaluatePlan, shoppingList, storeTotals,
  alternativesFor, consumeFromPantry, pantryCoverage, recipeServingCost, isVegetarian, emptyPlan,
  mondayOf, addDays, toISO, parseISO, daysBetween, currentPromos, allRecipes, matchWishes, complementSuggestions,
  extraPrices,
} from './planner.js';

// ---------- Būsena ----------

let state = loadState();
let live = null; // data/prices.json
let viewWeek = defaultWeek();
let modalRender = null;
let recipeFilter = { q: '', tag: 'all' };
let selectedDay = null; // telefone rodoma viena diena
const isWide = () => window.matchMedia('(min-width: 900px)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const today = () => toISO(new Date());

function defaultWeek() {
  const now = new Date();
  // Sekmadienį planuojame ateinančią savaitę.
  return now.getDay() === 0 ? addDays(mondayOf(now), 7) : mondayOf(now);
}

function save() {
  state.updatedAt = Date.now();
  if (!saveState(state) && !cloud.ref) toast('Nepavyko išsaugoti duomenų įrenginyje');
  scheduleCloudSave();
}

// ---------- Sinchronizacija per claude.ai paskyrą ----------
// Kai programėlė atidaryta claude.ai, duomenys saugomi privačiai jūsų paskyroje
// (data/users/<id>/), todėl tie patys planai matomi telefone ir kompiuteryje.
// Kitur (pvz. GitHub Pages) window.claude nėra – lieka tik naršyklės saugykla.

const DEVICE = Math.random().toString(36).slice(2, 10);
const cloud = { ref: null, downloads: null, timer: null, writing: Promise.resolve(), status: 'local' };

function scheduleCloudSave() {
  if (!cloud.ref) return;
  clearTimeout(cloud.timer);
  // Sujungiame greitus pakeitimus į vieną įrašą.
  cloud.timer = setTimeout(() => {
    const body = { state: JSON.parse(JSON.stringify(state)), updatedAt: state.updatedAt, device: DEVICE };
    cloud.writing = cloud.writing
      .then(() => cloud.ref.set(body))
      .then(() => (cloud.status = 'synced'))
      .catch((e) => {
        cloud.status = 'error';
        // Rašyti neleidžiama – toliau saugome tik naršyklėje.
        if (e?.code === 'invalid_argument' || e?.code === 'not_granted') cloud.ref = null;
        if (e?.code === 'quota_exceeded') toast('Debesies saugykla pilna – ištrinkite senus duomenis');
      });
  }, 1200);
}

async function initCloud() {
  if (!window.claude?.use) return;
  try {
    const [db, user, downloads] = await Promise.all([
      window.claude.use('db'),
      window.claude.use('user'),
      window.claude.use('downloads'),
    ]);
    cloud.downloads = downloads;
    const uid = user ? await user.id() : null;
    if (!db || !uid) return;
    // Draugai, kuriems puslapis pasidalintas tik peržiūrai, į saugyklą rašyti negali –
    // jiems duomenys lieka jų pačių naršyklėje.
    if ((await user.can?.('data.write')) === false) return;
    const ref = db.doc(`data/users/${uid}/state`);
    const snap = await ref.get();
    const remote = snap.exists ? snap.data() : null;
    cloud.ref = ref;
    cloud.status = 'synced';
    if (remote?.state && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
      state = mergeDefaults(remote.state);
      saveState(state);
      applyTheme();
      render();
    } else {
      scheduleCloudSave();
    }
    // Pakeitimai iš kito įrenginio atsiranda iškart.
    ref.onSnapshot((doc) => {
      const d = doc.exists ? doc.data() : null;
      if (!d?.state || d.device === DEVICE || (d.updatedAt || 0) <= (state.updatedAt || 0)) return;
      state = mergeDefaults(JSON.parse(JSON.stringify(d.state)));
      saveState(state);
      applyTheme();
      if (!$('#modal').open) render();
    });
    if (route() === 'nustatymai') render();
  } catch {
    cloud.status = 'local';
  }
}

function ctx() {
  return makeCtx(state, live, today());
}

function week(key = viewWeek) {
  const w = (state.weeks[key] ||= { plan: emptyPlan(), checked: {}, extras: [], wishes: [] });
  w.extras ||= [];
  w.wishes ||= [];
  return w;
}

function regenerate() {
  const w = week();
  w.plan = generatePlan(ctx(), { existing: w.plan, weekStart: viewWeek, todayIso: today(), wishes: w.wishes });
  save();
}

// ---------- Formatavimas ----------

const money = new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' });
const eur = (v) => money.format(v || 0);
const MONTHS = ['saus.', 'vas.', 'kov.', 'bal.', 'geg.', 'birž.', 'liep.', 'rugp.', 'rugs.', 'spal.', 'lapkr.', 'gruod.'];
const fmtDate = (iso) => {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} d.`;
};
const num = (v, d = 2) => Number(v).toLocaleString('lt-LT', { maximumFractionDigits: d });

function fmtQty(q, unit) {
  if (unit === 'g') return q >= 1000 ? `${num(q / 1000)} kg` : `${num(q, 0)} g`;
  if (unit === 'ml') return q >= 1000 ? `${num(q / 1000)} l` : `${num(q, 0)} ml`;
  return `${num(q, 1)} vnt.`;
}

function fmtPacks(packs, ing) {
  if (ing.unit === 'vnt' && ing.pack === 1) return `${packs} vnt.`;
  return `${packs} × ${fmtQty(ing.pack, ing.unit)}`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const storeName = (id) => STORES.find((s) => s.id === id)?.name || id;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Modalinis langas ----------

function openModal(title, render) {
  modalRender = render;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = render();
  const dlg = $('#modal');
  if (!dlg.open) dlg.showModal();
}

function closeModal() {
  modalRender = null;
  $('#modal').close();
}

// Patvirtinimo langas programėlės viduje (naršyklės patvirtinimo langai kai kur neveikia ir telefone atrodo prastai).
let pendingConfirm = null;
function askConfirm(title, message, yesLabel, onYes) {
  pendingConfirm = onYes;
  openModal(title, () => `
    <p>${esc(message)}</p>
    <div class="toolbar confirm-actions">
      <button class="btn" data-action="close-modal">Atšaukti</button>
      <button class="btn danger" data-action="confirm-yes">${esc(yesLabel)}</button>
    </div>`);
}

function refreshModal() {
  if (modalRender && $('#modal').open) $('#modal-body').innerHTML = modalRender();
}

// ---------- Plano pagalbinės ----------

// Užtikrina, kad likučių pietūs atitiktų vakarykštę vakarienę.
function syncLeftovers(plan) {
  for (let d = 0; d < 7; d++) {
    const dinner = plan.days[d].vakariene;
    const next = d < 6 ? plan.days[d + 1].pietus : null;
    const ok = dinner && dinner.recipeId && !dinner.skip;
    if (next?.leftover) {
      if (ok) {
        next.recipeId = dinner.recipeId;
        if (!dinner.cooked) dinner.extra = next.servings || state.settings.people;
      } else {
        delete plan.days[d + 1].pietus;
      }
    } else if (dinner && dinner.extra && !dinner.cooked) {
      delete dinner.extra;
    }
  }
}

// Pasirinkta parduotuvė arba „pair“ (dviejų parduotuvių derinys); jei netinka – pigiausia.
function selectedStore(c, totals) {
  const sel = state.settings.selectedStore;
  if (sel === 'pair' && totals.bestPair) return 'pair';
  return c.stores.includes(sel) ? sel : totals.cheapest;
}

function planSummary() {
  const c = ctx();
  const w = week();
  const ev = evaluatePlan(w.plan, c, { weekStart: viewWeek, todayIso: today() });
  const totals = storeTotals(ev.items, c, w.extras);
  return { c, w, ev, totals };
}

// ---------- Vaizdai ----------

const views = { plan: viewPlan, list: viewList, pantry: viewPantry, budget: viewBudget, recipes: viewRecipes, nustatymai: viewSettings };

function route() {
  const r = location.hash.replace('#', '') || 'plan';
  return views[r] ? r : 'plan';
}

function render() {
  const r = route();
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  $('#view').innerHTML = views[r]();
  if (r === 'recipes') renderRecipeGrid();
  refreshModal();
}

function weekHeader(subtitle) {
  const end = addDays(viewWeek, 6);
  const isCurrent = viewWeek === mondayOf(new Date());
  return `
  <header class="page-head">
    <div class="week-nav">
      <button class="icon-btn" data-action="week" data-dir="-1" aria-label="Ankstesnė savaitė">‹</button>
      <div>
        <h1>${subtitle}</h1>
        <p class="muted">${fmtDate(viewWeek)} – ${fmtDate(end)}${isCurrent ? ' · ši savaitė' : ''}</p>
      </div>
      <button class="icon-btn" data-action="week" data-dir="1" aria-label="Kita savaitė">›</button>
    </div>
  </header>`;
}

// Parduotuvės, kurių kainos surinktos automatiškai ir dar šviežios.
function liveStoreIds() {
  return new Set(Object.entries(live?.sources || {}).filter(([, v]) => daysBetween(v.updatedAt.slice(0, 10), today()) <= 8).map(([k]) => k));
}

function priceStatusBadge() {
  const srcs = live?.sources ? Object.entries(live.sources) : [];
  if (!srcs.length) return '<span class="badge">Kainos apytikslės</span>';
  const fresh = srcs.filter(([, v]) => daysBetween(v.updatedAt.slice(0, 10), today()) <= 8).map(([k]) => storeName(k));
  return fresh.length
    ? `<span class="badge ok" title="Automatiškai surinktos kainos">Kainos: ${fresh.join(', ')}</span>`
    : '<span class="badge">Kainos pasenusios – naudojamos apytikslės</span>';
}

// ----- Planas -----

function viewPlan() {
  const { c, w, ev, totals } = planSummary();
  const st = state.settings;
  const budget = st.budget || 0;
  const best = totals.cheapest;
  const pct = budget ? Math.min(100, (totals.totals[best] / budget) * 100) : 0;
  const slots = SLOTS.filter((s) => st.meals.includes(s));
  const hasPlan = w.plan.days.some((d) => Object.keys(d).length);
  const promos = currentPromos(c);
  const promoInPlan = ev.items.filter((i) => i.promoStores.length && i.packs > 0);

  const todayIdx = daysBetween(viewWeek, today());
  const activeDay = selectedDay ?? (todayIdx >= 0 && todayIdx < 7 ? todayIdx : 0);
  const dayTabs = DAY_NAMES.map((n, d) => {
    const date = addDays(viewWeek, d);
    const filled = slots.filter((s) => w.plan.days[d][s]).length;
    return `<button class="day-tab ${d === activeDay ? 'active' : ''} ${date === today() ? 'today' : ''}" data-action="pick-day" data-d="${d}" aria-pressed="${d === activeDay}">
      <span>${n.slice(0, 2)}</span><b>${parseISO(date).getDate()}</b><i class="${filled ? 'on' : ''}"></i></button>`;
  }).join('');

  const days = w.plan.days
    .map((day, d) => {
      const date = addDays(viewWeek, d);
      const meals = slots.map((s) => mealButton(day[s], d, s, c)).join('');
      const kcal = slots.reduce((sum, s) => sum + (day[s] && !day[s].skip ? c.recipes[day[s].recipeId]?.kcal || 0 : 0), 0);
      return `
      <article class="day ${date === today() ? 'today' : ''} ${d === activeDay ? 'active' : ''}">
        <header><b>${DAY_NAMES[d]}</b><span class="muted">${fmtDate(date)}</span></header>
        ${meals}
        ${kcal ? `<footer class="muted small">~${kcal} kcal žmogui</footer>` : ''}
      </article>`;
    })
    .join('');

  return `
  ${weekHeader('Savaitės planas')}
  <section class="summary-strip">
    <div class="sum-main">
      <b>${eur(totals.totals[best])}</b><span class="muted"> iš ${eur(budget)} · ${storeName(best)}</span>
    </div>
    <div class="bar"><span style="width:${pct}%" class="${budget && totals.totals[best] > budget ? 'over' : ''}"></span></div>
    <div class="sum-meta muted">~${num(ev.kcalPerDay, 0)} kcal · ${num(ev.proteinPerDay, 0)} g baltymų · švaistymas ${eur(ev.waste)}${promos.length ? ` · 🏷️ ${promoInPlan.length}` : ''}</div>
  </section>
  <section class="cards plan-cards">
    <div class="card stat">
      <span class="muted">Numatoma kaina</span>
      <b class="big">${eur(totals.totals[best])}</b>
      <div class="bar"><span style="width:${pct}%" class="${budget && totals.totals[best] > budget ? 'over' : ''}"></span></div>
      <span class="small muted">Biudžetas ${eur(budget)} · pigiausia ${storeName(best)}</span>
    </div>
    <div class="card stat">
      <span class="muted">Galimas švaistymas</span>
      <b class="big">${eur(ev.waste)}</b>
      <span class="small muted">greitai gendančių produktų likučiai</span>
    </div>
    <div class="card stat">
      <span class="muted">Mityba (žmogui per dieną)</span>
      <b class="big">~${num(ev.kcalPerDay, 0)} kcal</b>
      <span class="small muted">${num(ev.proteinPerDay, 0)} g baltymų · be užkandžių</span>
    </div>
    <div class="card stat">
      <span class="muted">Akcijos</span>
      <b class="big">${promoInPlan.length} / ${promos.length}</b>
      <span class="small muted">plane panaudota / iš viso žinoma</span>
    </div>
  </section>

  ${wishesHtml(c)}

  <div class="toolbar plan-actions">
    <button class="btn primary" data-action="generate">✨ ${hasPlan ? 'Perplanuoti' : 'Sudaryti planą'}</button>
    ${hasPlan ? '<button class="btn" data-action="clear-plan">Išvalyti</button>' : ''}
    <a class="btn wide-only" href="#list">🛒 Pirkinių sąrašas</a>
    <span class="wide-only">${priceStatusBadge()}</span>
  </div>
  ${hasPlan ? '<p class="hint wide-only">Paspauskite patiekalą, kad pakeistumėte, užrakintumėte ar pažymėtumėte kaip pagamintą. Užrakinti 🔒 patiekalai perplanuojant nesikeičia.</p>' : `<p class="hint">Paspauskite „Sudaryti planą“: programa parinks ${st.people} žm. patiekalus pagal biudžetą, akcijas, tai, ką turite šaldytuve, ir taip, kad produktai būtų sunaudoti iki galo.</p>`}
  <nav class="day-tabs" aria-label="Savaitės dienos">${dayTabs}</nav>
  <section class="days">${days}</section>`;
}

function wishesHtml(c) {
  const w = week();
  const wishes = w.wishes.map((id) => c.recipes[id]).filter(Boolean);
  const sugg = complementSuggestions(w.wishes, c, { todayIso: today() });
  const unmatched = w.unmatched || [];
  return `
  <section class="card wishes">
    <h2>Ką norite valgyti šią savaitę?</h2>
    <form class="inline-form" data-form="wishes">
      <input name="text" placeholder="pvz.: kugelis, cepelinai, balandėliai" aria-label="Norimi patiekalai" class="grow" autocomplete="off">
      <button class="btn primary">Pridėti</button>
    </form>
    ${wishes.length ? `<div class="chips">${wishes.map((r) => `<button class="chip wish" data-action="wish-remove" data-id="${r.id}" title="Pašalinti">❤️ ${esc(r.name)} ✕</button>`).join('')}</div>` : '<p class="small muted wide-only">Įrašykite patiekalus, kurių norisi – programa juos išdėlios savaitėje, o likusias dienas užpildys tuos pačius produktus naudojančiais patiekalais.</p>'}
    ${unmatched.length ? `<p class="small">Neradau: ${unmatched.map((t) => `<b>${esc(t)}</b> <button class="link" data-action="wish-create" data-name="${esc(t)}">sukurti receptą</button>`).join(', ')}</p>` : ''}
    ${sugg.length ? `
      <details class="sugg" ${isWide() ? 'open' : ''}>
      <summary>💡 Prie jūsų norų dar tiktų (${sugg.length})</summary>
      <ul class="pick-list">${sugg.map(({ recipe: r, saving, shared }) => `
        <li><button data-action="wish-add" data-id="${r.id}">
          <span>${esc(r.name)}<small class="muted wide-only"> · panaudos ${shared.slice(0, 3).map((id) => INGREDIENTS[id].name.toLowerCase()).join(', ')}</small></span>
          <b class="ok-text">−${eur(saving)}</b>
        </button></li>`).join('')}
      </ul></details>` : ''}
  </section>`;
}

function mealButton(e, d, s, c) {
  if (!e) {
    return `<button class="meal empty" data-action="meal" data-d="${d}" data-s="${s}"><span class="slot">${SLOT_LABELS[s]}</span><span>+ Pridėti</span></button>`;
  }
  if (e.skip) {
    return `<button class="meal skip" data-action="meal" data-d="${d}" data-s="${s}"><span class="slot">${SLOT_LABELS[s]}</span><span>🍽️ Valgome ne namie</span></button>`;
  }
  const r = c.recipes[e.recipeId];
  if (!r) return '';
  const flags = [
    e.wish ? '❤️' : '',
    e.locked ? '🔒' : '',
    e.leftover ? '♻️ likučiai' : '',
    e.extra ? '×2 (likučiams)' : '',
    e.cooked ? '✅' : '',
  ].filter(Boolean).join(' ');
  return `
  <button class="meal ${e.cooked ? 'cooked' : ''} ${e.leftover ? 'leftover' : ''}" data-action="meal" data-d="${d}" data-s="${s}">
    <span class="slot">${SLOT_LABELS[s]} ${flags ? `<span class="flags">${flags}</span>` : ''}</span>
    <span class="title">${esc(r.name)}</span>
    <span class="meta">${e.leftover ? 'pašildyti' : `⏱ ${r.time} min`} · ${r.kcal} kcal</span>
  </button>`;
}

function recipeDetailHtml(r, servings, c) {
  const rows = Object.entries(r.ing)
    .map(([id, q]) => {
      const ing = INGREDIENTS[id];
      return ing ? `<li><span>${esc(ing.name)}</span><span class="muted">${fmtQty(q * servings, ing.unit)}</span></li>` : '';
    })
    .join('');
  const tags = [
    isVegetarian(r) ? '🌱 Vegetariškas' : '',
    r.soup ? '🍲 Sriuba' : '',
    r.time <= 20 ? '⚡ Greitas' : '',
    r.custom ? '✍️ Mano' : '',
  ].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join('');
  return `
    <div class="chips">${tags}<span class="chip">⏱ ${r.time} min</span><span class="chip">${r.kcal} kcal</span><span class="chip">${r.protein || 0} g baltymų</span><span class="chip">~${eur(recipeServingCost(r, c))}/porc.</span></div>
    <h3>Ingredientai (${servings} porc.)</h3>
    <ul class="ing-list">${rows}</ul>
    ${r.steps?.length ? `<h3>Gaminimas</h3><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}`;
}

function openMeal(d, s) {
  const plan = week().plan;
  const e = plan.days[d][s];
  if (!e || (!e.recipeId && !e.skip)) return openAlternatives(d, s);
  openModal(`${DAY_NAMES[d]} · ${SLOT_LABELS[s]}`, () => {
    const cur = week().plan.days[d][s];
    if (!cur) return '<p>Patiekalas pašalintas.</p>';
    const c = ctx();
    if (cur.skip) {
      return `<p>Šiam valgymui nieko negaminsite.</p>
        <div class="toolbar"><button class="btn primary" data-action="alts" data-d="${d}" data-s="${s}">Parinkti patiekalą</button>
        <button class="btn" data-action="meal-remove" data-d="${d}" data-s="${s}">Išvalyti</button></div>`;
    }
    const r = c.recipes[cur.recipeId];
    const total = (cur.servings || 0) + (cur.extra || 0);
    return `
      <h3 class="recipe-title">${esc(r.name)}</h3>
      ${cur.leftover ? '<p class="note">♻️ Likučiai iš vakarykštės vakarienės – nieko papildomai pirkti nereikia.</p>' : ''}
      ${cur.extra ? `<p class="note">Gaminkite dvigubai (${total} porc.) – pusė liks rytojaus pietums.</p>` : ''}
      ${cur.leftover ? '' : `
      <div class="stepper"><span>Porcijos:</span>
        <button class="icon-btn" data-action="servings" data-d="${d}" data-s="${s}" data-delta="-1">−</button>
        <b>${cur.servings}</b>
        <button class="icon-btn" data-action="servings" data-d="${d}" data-s="${s}" data-delta="1">+</button>
      </div>`}
      <div class="toolbar wrap">
        ${cur.leftover ? `<button class="btn" data-action="unleftover" data-d="${d}">Gaminti atskirą patiekalą</button>` : `<button class="btn" data-action="alts" data-d="${d}" data-s="${s}">🔄 Pakeisti</button>`}
        <button class="btn" data-action="lock" data-d="${d}" data-s="${s}">${cur.locked ? '🔓 Atrakinti' : '🔒 Užrakinti'}</button>
        <button class="btn ${cur.cooked ? '' : 'primary'}" data-action="cooked" data-d="${d}" data-s="${s}">${cur.cooked ? '↩️ Nepagaminta' : '✅ Pagaminta'}</button>
        <button class="btn" data-action="skip" data-d="${d}" data-s="${s}">🍽️ Ne namie</button>
        <button class="btn danger" data-action="meal-remove" data-d="${d}" data-s="${s}">Pašalinti</button>
      </div>
      ${recipeDetailHtml(r, total || state.settings.people, c)}`;
  });
}

function openAlternatives(d, s) {
  openModal(`Pasirinkite: ${DAY_NAMES[d]}, ${SLOT_LABELS[s].toLowerCase()}`, () => {
    const c = ctx();
    const alts = alternativesFor(week().plan, d, s, c, { todayIso: today() });
    const cur = week().plan.days[d][s];
    return `
      <p class="hint">Surikiuota pagal tai, kiek papildomai kainuos (atsižvelgiant į jau perkamus produktus, tai, ką turite namie, ir akcijas).</p>
      <div class="toolbar"><button class="btn" data-action="skip" data-d="${d}" data-s="${s}">🍽️ Valgome ne namie</button></div>
      <ul class="pick-list">
        ${alts.map(({ recipe: r, extraCost }) => `
          <li><button data-action="set-recipe" data-d="${d}" data-s="${s}" data-id="${r.id}" class="${cur?.recipeId === r.id ? 'current' : ''}">
            <span>${c.favorites.has(r.id) ? '⭐ ' : ''}${esc(r.name)}<small class="muted"> · ${r.time} min · ${r.kcal} kcal${isVegetarian(r) ? ' · 🌱' : ''}</small></span>
            <b class="${extraCost < 0.01 ? 'ok-text' : ''}">${extraCost < 0.01 ? 'jau turite' : '+' + eur(extraCost)}</b>
          </button></li>`).join('')}
      </ul>`;
  });
}

// ----- Pirkiniai -----

function viewList() {
  const { c, w, ev, totals } = planSummary();
  const sel = selectedStore(c, totals);
  const pair = totals.bestPair;
  const liveIds = liveStoreIds();
  const priceAt = (it) => (sel === 'pair' ? it.prices[pair.assign[it.ingId]] : it.prices[sel]) || 0;
  const storeOf = (it) => (sel === 'pair' ? pair.assign[it.ingId] : sel);

  const buy = ev.items.filter((i) => i.packs > 0 && !i.staple);
  const staples = ev.items.filter((i) => i.staple);
  const covered = ev.items.filter((i) => i.packs === 0 && !i.staple);
  const total = buy.length + w.extras.length;
  const done = buy.filter((i) => w.checked[i.ingId]).length + w.extras.filter((x) => x.checked).length;
  const extraAt = (x) => {
    const p = extraPrices(x, c);
    return sel === 'pair' ? p[pair.assign[`extra:${x.id}`] || pair.stores[0]] : p[sel];
  };
  const spentChecked = buy.filter((i) => w.checked[i.ingId]).reduce((s, i) => s + priceAt(i), 0) + w.extras.filter((x) => x.checked).reduce((s, x) => s + extraAt(x), 0);
  const saving = totals.totals[totals.cheapest] - pair.total;

  const groups = {};
  for (const it of buy) (groups[it.cat] ||= []).push(it);

  const itemRow = (it) => {
    const ing = INGREDIENTS[it.ingId];
    const info = c.infoOf(it.ingId, storeOf(it));
    const promo = info.promo;
    const oldTotal = promo && info.oldPrice ? info.oldPrice * it.packs : null;
    return `
    <label class="item ${w.checked[it.ingId] ? 'checked' : ''}">
      <input type="checkbox" data-change="check" data-id="${it.ingId}" ${w.checked[it.ingId] ? 'checked' : ''}>
      <span class="item-main">
        <b>${esc(it.name)}</b>
        <small class="muted">${fmtPacks(it.packs, ing)} · reikia ${fmtQty(it.toBuy, ing.unit)}${it.have > 0 ? ` · namie ${fmtQty(it.have, ing.unit)}` : ''}</small>
        ${promo ? `<small class="promo">🏷️ Akcija${info.until ? ` iki ${fmtDate(info.until.slice(0, 10))}` : ''}${info.note ? ` · ${esc(info.note)}` : ''}</small>` : it.promoStores.length ? `<small class="muted">🏷️ akcija: ${it.promoStores.map(storeName).join(', ')}</small>` : ''}
      </span>
      <button class="btn small have-btn" data-action="have" data-id="${it.ingId}" title="Jau turiu namie – nepirkti" aria-label="Jau turiu namie">🏠<span class="hide-sm"> Turiu</span></button>
      <span class="item-price">
        ${sel === 'pair' ? `<span class="store-tag">${storeName(storeOf(it))}</span>` : ''}
        ${oldTotal ? `<s class="muted small">${eur(oldTotal)}</s>` : ''}
        <b>${eur(priceAt(it))}</b>
        ${info.source === 'estimate' ? '<small class="muted" title="Apytikslė kaina">~</small>' : ''}
      </span>
    </label>`;
  };

  const sortChecked = (a, b) => (w.checked[a.ingId] ? 1 : 0) - (w.checked[b.ingId] ? 1 : 0);

  return `
  ${weekHeader('Pirkinių sąrašas')}
  ${buy.length || w.extras.length ? `
  <section class="card">
    <div class="progress-row"><b>${done} / ${total} paimta</b><span class="muted">${eur(spentChecked)} krepšelyje</span></div>
    <div class="bar"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div>
  </section>` : ''}

  <section class="card">
    <h2>Kur pirkti?</h2>
    <div class="store-chips" role="list">
      ${totals.ranked.map((s) => `
        <button class="store-chip ${sel === s ? 'active' : ''}" data-action="select-store" data-store="${s}">
          <span>${storeName(s)}${s === totals.cheapest ? ' <em>pigiausia</em>' : ''}</span><b>${liveIds.size && !liveIds.has(s) ? '~' : ''}${eur(totals.totals[s])}</b>
          ${liveIds.size ? `<small class="${liveIds.has(s) ? 'ok-text' : 'muted'}">${liveIds.has(s) ? 'tikros kainos' : 'apytiksliai'}</small>` : ''}
        </button>`).join('')}
      ${pair && saving > 0.3 ? `
        <button class="store-chip ${sel === 'pair' ? 'active' : ''}" data-action="select-store" data-store="pair">
          <span>${pair.stores.map(storeName).join(' + ')}</span><b>${eur(pair.total)}</b>
        </button>` : ''}
    </div>
    ${pair && saving > 0.3 ? `<p class="hint wide-only">💡 Apsipirkę dviejose parduotuvėse (${pair.stores.map(storeName).join(' ir ')}) sutaupytumėte ${eur(saving)}.</p>` : ''}
    ${nearbyHtml(totals)}
  </section>

  ${buy.length ? Object.keys(CATEGORIES).filter((k) => groups[k]).map((k) => `
    <section class="card list-group">
      <h3>${CATEGORIES[k]}</h3>
      ${groups[k].sort(sortChecked).map(itemRow).join('')}
    </section>`).join('') : `<section class="card"><p>${week().plan.days.some((d) => Object.keys(d).length) ? 'Viskas, ko reikia, jau yra namie. 🎉' : 'Pirmiausia sudarykite savaitės planą.'}</p><a class="btn" href="#plan">📅 Į planą</a></section>`}

  <section class="card list-group">
    <h3>🥤 Gėrimai ir kita</h3>
    ${w.extras.map((x) => {
      const ing = x.ingId && INGREDIENTS[x.ingId];
      const store = sel === 'pair' ? pair.assign[`extra:${x.id}`] : sel;
      const info = ing ? c.infoOf(x.ingId, store) : null;
      return `
      <div class="item ${x.checked ? 'checked' : ''}">
        <input type="checkbox" data-change="check-extra" data-id="${x.id}" ${x.checked ? 'checked' : ''} aria-label="Paimta">
        <span class="item-main">
          <b>${esc(ing ? ing.name : x.name)}</b>
          ${ing ? `<small class="muted">${eur(info.price)} / vnt.${info.promo ? ' · <span class="promo">🏷️ akcija</span>' : ''}${info.source === 'estimate' ? ' · apytikslė' : ''}</small>` : '<small class="muted">savo kaina</small>'}
        </span>
        ${ing ? `<span class="stepper small">
          <button class="icon-btn small" data-action="extra-qty" data-id="${x.id}" data-delta="-1" aria-label="Mažiau">−</button><b>${x.qty}</b>
          <button class="icon-btn small" data-action="extra-qty" data-id="${x.id}" data-delta="1" aria-label="Daugiau">+</button></span>` : ''}
        <span class="item-price">${sel === 'pair' && ing ? `<span class="store-tag">${storeName(store)}</span>` : ''}<b>${eur(extraAt(x))}</b>
          <button class="icon-btn small" data-action="extra-remove" data-id="${x.id}" aria-label="Pašalinti">✕</button></span>
      </div>`;
    }).join('')}
    <form class="inline-form" data-form="extra-catalog">
      <select name="ingId" class="grow" aria-label="Prekė">${ingredientOptions('', { only: EXTRA_CATS })}</select>
      <input name="qty" type="number" min="1" step="1" value="1" class="w-70" aria-label="Kiekis">
      <button class="btn">Pridėti</button>
    </form>
    <details>
      <summary class="small">Kita prekė (įrašyti pačiam)</summary>
      <form class="inline-form" data-form="extra">
        <input name="name" placeholder="pvz. tualetinis popierius" required aria-label="Prekė" class="grow">
        <input name="price" type="number" step="0.01" min="0" placeholder="€" aria-label="Kaina" class="w-80">
        <button class="btn">Pridėti</button>
      </form>
    </details>
  </section>

  ${staples.length ? `
  <details class="card">
    <summary>Bazinės atsargos – patikrinkite, ar turite (${staples.length})</summary>
    <p class="small muted">${staples.map((i) => `${esc(i.name)} (${fmtQty(i.need, i.unit)})`).join(', ')}</p>
    <p class="small muted">Jei jų neturite, išjunkite „Bazinės atsargos visada namie“ nustatymuose.</p>
  </details>` : ''}
  ${covered.length ? `
  <details class="card">
    <summary>Jau turite namie (${covered.length})</summary>
    <p class="small muted">${covered.map((i) => `${esc(i.name)} – ${fmtQty(i.need, i.unit)}`).join(', ')}</p>
  </details>` : ''}

  <div class="toolbar sticky-actions">
    <button class="btn" data-action="share-list">📤 Dalintis</button>
    <button class="btn primary" data-action="finish-shopping" ${done ? '' : 'disabled'}>✔️ Baigti apsipirkimą</button>
  </div>`;
}

// ----- Artimiausios parduotuvės (OpenStreetMap) -----

function nearbyHtml(totals) {
  const n = state.nearby;
  const body = n?.list?.length
    ? `
      <p class="small muted">Pagal jūsų vietą (${fmtDate(n.at.slice(0, 10))}). Tinklų kainos Lietuvoje vienodos visose parduotuvėse, todėl krepšelio kaina skiriasi pagal tinklą.</p>
      <ul class="nearby">
        ${n.list.map((s) => `
          <li>
            <span><b>${esc(s.name)}</b><small class="muted">${esc(s.address || '')}</small></span>
            <span class="muted">${num(s.dist, 1)} km</span>
            <span>${s.chain && totals.totals[s.chain] !== undefined ? `<b>${eur(totals.totals[s.chain])}</b>` : ''}</span>
            <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}">Kelias</a>
          </li>`).join('')}
      </ul>
      <button class="btn small" data-action="find-nearby">🔄 Atnaujinti vietą</button>`
    : window.claude?.use
      ? '' // claude.ai puslapyje vietos nustatymas neleidžiamas – lieka žemėlapio nuorodos
      : `<button class="btn btn-wrap" data-action="find-nearby">📍 Rasti artimiausias parduotuves</button>`;
  // Google Maps telefone pats naudoja jūsų vietą, todėl paieška „Lidl“ rodo artimiausias.
  const maps = `<div class="map-links"><span class="small muted">Žemėlapyje:</span>${STORES.map((s) => `<a class="chip" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' parduotuvė')}">${s.name}${totals.totals[s.id] !== undefined ? ` · ${eur(totals.totals[s.id])}` : ''}</a>`).join('')}</div>`;
  return `<div class="nearby-box"><h3>Artimiausios parduotuvės</h3>${maps}${body}</div>`;
}

function haversine(a, b, c, d) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLon = toRad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function chainOf(tags) {
  const text = `${tags.brand || ''} ${tags.name || ''} ${tags.operator || ''}`;
  return STORES.find((s) => s.match.test(text))?.id || null;
}

async function findNearby() {
  if (!navigator.geolocation) return toast('Įrenginys nepalaiko vietos nustatymo');
  toast('Nustatoma vieta…');
  let pos;
  try {
    pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }));
  } catch {
    return toast('Vietos nustatyti nepavyko – naudokite „Žemėlapyje“ nuorodas');
  }
  const { latitude: lat, longitude: lon } = pos.coords;
  toast('Ieškoma parduotuvių…');
  // Ieškome iki 15 km, kad rastume bent po vieną kiekvieno tinklo parduotuvę.
  const q = `[out:json][timeout:25];(nwr["shop"~"supermarket|convenience|discount"](around:15000,${lat},${lon}););out center tags;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const all = data.elements
      .map((e) => {
        const t = e.tags || {};
        const la = e.lat ?? e.center?.lat;
        const lo = e.lon ?? e.center?.lon;
        const chain = chainOf(t);
        if (!chain || la === undefined) return null;
        const address = [t['addr:street'], t['addr:housenumber'], t['addr:city']].filter(Boolean).join(' ');
        return { name: t.name || storeName(chain), chain, lat: la, lon: lo, address, dist: haversine(lat, lon, la, lo) };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);
    // Artimiausia kiekvieno tinklo parduotuvė + dar kelios artimiausios.
    const perChain = STORES.map((s) => all.find((x) => x.chain === s.id)).filter(Boolean);
    const extra = all.filter((x) => !perChain.includes(x)).slice(0, 5);
    const list = [...perChain, ...extra].sort((a, b) => a.dist - b.dist);
    state.nearby = { at: new Date().toISOString(), lat, lon, list };
    save();
    render();
    toast(list.length ? `Rasta ${list.length} parduotuvių` : 'Netoliese parduotuvių nerasta');
  } catch {
    toast('Nepavyko gauti parduotuvių sąrašo – bandykite vėliau');
  }
}

// ----- Sandėliukas -----

function ingredientOptions(selected = '', { only = null, exclude = [] } = {}) {
  return Object.entries(CATEGORIES)
    .filter(([k]) => (!only || only.includes(k)) && !exclude.includes(k))
    .map(([k, label]) => `<optgroup label="${label}">${Object.values(INGREDIENTS).filter((i) => i.cat === k).sort((a, b) => a.name.localeCompare(b.name, 'lt')).map((i) => `<option value="${i.id}" ${i.id === selected ? 'selected' : ''}>${esc(i.name)} (${i.unit})</option>`).join('')}</optgroup>`)
    .join('');
}

function viewPantry() {
  const c = ctx();
  const t = today();
  const items = [...state.pantry].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  const people = state.settings.people;
  const suggestions = Object.values(c.recipes)
    .map((r) => ({ r, cov: pantryCoverage(r, c, people, t) }))
    .filter((x) => x.cov > 0.3)
    .sort((a, b) => b.cov - a.cov)
    .slice(0, 6);

  const first = Object.values(INGREDIENTS)[0];
  return `
  <header class="page-head"><h1>Šaldytuvas ir spintelės</h1><p class="muted">Kas jau yra namie. Planuojant šie produktai panaudojami pirmiausia (ypač tie, kurių galiojimas baigiasi), o pirkinių sąraše jų nebesiūloma pirkti.</p></header>
  <section class="card">
    <h2>Pridėti produktą</h2>
    <form class="grid-form" data-form="pantry">
      <label>Produktas<select name="ingId" data-change="pantry-ing">${ingredientOptions()}</select></label>
      <label>Kiekis (<span data-unit>${first.unit}</span>)<input name="qty" type="number" min="0" step="any" value="${first.pack}" required></label>
      <label>Tinka iki<input name="expiry" type="date" value="${addDays(t, first.shelf > 365 ? 365 : first.shelf)}"></label>
      <button class="btn primary">Pridėti</button>
    </form>
  </section>
  ${suggestions.length ? `
  <section class="card">
    <h2>🍳 Ką pagaminti iš to, ką turite?</h2>
    <ul class="pick-list">${suggestions.map(({ r, cov }) => `
      <li><button data-action="recipe" data-id="${r.id}"><span>${esc(r.name)}</span><b>${Math.round(cov * 100)} % turite</b></button></li>`).join('')}
    </ul>
  </section>` : ''}
  <section class="card">
    <h2>Turiu namie (${items.length})</h2>
    ${items.length ? `<ul class="pantry">${items.map((p) => {
      const ing = INGREDIENTS[p.ingId];
      if (!ing) return '';
      const left = p.expiry ? daysBetween(t, p.expiry) : null;
      const cls = left === null ? '' : left < 0 ? 'expired' : left <= 2 ? 'soon' : left <= 5 ? 'warn' : '';
      const label = left === null ? '' : left < 0 ? 'pasibaigęs' : left === 0 ? 'baigiasi šiandien' : `liko ${left} d.`;
      return `
      <li class="${cls}">
        <span><b>${esc(ing.name)}</b><small class="muted">${p.expiry ? `iki ${fmtDate(p.expiry)}` : ''}</small></span>
        <input type="number" min="0" step="any" value="${Math.round(p.qty * 10) / 10}" data-change="pantry-qty" data-id="${p.id}" aria-label="Kiekis" class="w-90">
        <span class="muted small">${ing.unit}</span>
        <span class="exp">${label}</span>
        <button class="icon-btn small" data-action="pantry-remove" data-id="${p.id}" aria-label="Pašalinti">✕</button>
      </li>`;
    }).join('')}</ul>` : '<p class="muted">Kol kas tuščia. Pridėkite, ką turite, arba pirkinių sąraše spauskite „🏠 Turiu“. Baigus apsipirkimą, paimtos prekės čia įtraukiamos automatiškai.</p>'}
  </section>`;
}

// ----- Biudžetas -----

const CAT_COLORS = {
  darzoves: '#4caf50', mesa: '#e05d5d', pienas: '#5b9bd5', kruopos: '#d9a441', duona: '#b07d4f',
  konservai: '#9c6ade', saldyti: '#3fb8c4', bazine: '#8d99a6', gerimai: '#f08c3a', kita: '#e36fae', nenurodyta: '#c3c9d0',
};
const catLabel = (k) => CATEGORIES[k] || 'Nenurodyta';

// Pirkinių kaina pagal kategorijas konkrečioje parduotuvėje (arba pigiausiai).
function categoryBreakdown(items, extras, c, store) {
  const at = (prices) => (c.stores.includes(store) ? prices[store] : Math.min(...Object.values(prices)));
  const out = {};
  for (const it of items) out[it.cat] = (out[it.cat] || 0) + at(it.prices);
  for (const x of extras) {
    const cat = x.ingId ? INGREDIENTS[x.ingId]?.cat || 'kita' : 'kita';
    out[cat] = (out[cat] || 0) + at(extraPrices(x, c));
  }
  return out;
}

function catBars(cats) {
  const entries = Object.entries(cats).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return '<p class="muted small">Dar nėra duomenų.</p>';
  return `
    <div class="stack-bar" role="img" aria-label="Išlaidų pasiskirstymas">${entries.map(([k, v]) => `<span style="width:${(v / total) * 100}%;background:${CAT_COLORS[k] || CAT_COLORS.nenurodyta}" title="${catLabel(k)}: ${eur(v)}"></span>`).join('')}</div>
    <ul class="cat-list">${entries.map(([k, v]) => `
      <li><span class="dot" style="background:${CAT_COLORS[k] || CAT_COLORS.nenurodyta}"></span><span>${catLabel(k)}</span>
      <span class="cat-bar"><span style="width:${(v / entries[0][1]) * 100}%;background:${CAT_COLORS[k] || CAT_COLORS.nenurodyta}"></span></span>
      <b>${eur(v)}</b><span class="muted small">${Math.round((v / total) * 100)} %</span></li>`).join('')}
    </ul>`;
}

function periodExpenses(p) {
  const t = today();
  if (p === 'week') return state.expenses.filter((e) => mondayOf(parseISO(e.date)) === mondayOf(new Date()));
  if (p === 'month') return state.expenses.filter((e) => e.date.slice(0, 7) === t.slice(0, 7));
  return state.expenses;
}

function spentByCategory(expenses) {
  const out = {};
  for (const e of expenses) {
    if (e.cats && Object.keys(e.cats).length) for (const [k, v] of Object.entries(e.cats)) out[k] = (out[k] || 0) + v;
    else out.nenurodyta = (out.nenurodyta || 0) + e.amount;
  }
  return out;
}

let statsPeriod = 'month';

function viewBudget() {
  const { c, ev, w, totals } = planSummary();
  const st = state.settings;
  const thisWeek = mondayOf(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const spentIn = (wk) => state.expenses.filter((e) => mondayOf(parseISO(e.date)) === wk).reduce((s, e) => s + e.amount, 0);
  const spent = weeks.map(spentIn);
  const maxV = Math.max(st.budget || 0, ...spent, 1);
  const nonZero = spent.filter((v) => v > 0);
  const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  const cur = spentIn(thisWeek);
  const expenses = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return `
  <header class="page-head"><h1>Biudžetas</h1></header>
  <section class="cards">
    <div class="card stat"><span class="muted">Savaitės biudžetas</span>
      <label class="inline"><input type="number" min="0" step="1" value="${st.budget}" data-change="setting" data-key="budget" class="w-90"> €</label>
      <span class="small muted">${eur(st.budget / 7 / Math.max(1, st.people))} žmogui per dieną</span></div>
    <div class="card stat"><span class="muted">Išleista šią savaitę</span><b class="big">${eur(cur)}</b>
      <div class="bar"><span style="width:${st.budget ? Math.min(100, (cur / st.budget) * 100) : 0}%" class="${cur > st.budget ? 'over' : ''}"></span></div>
      <span class="small muted">liko ${eur(Math.max(0, st.budget - cur))}</span></div>
    <div class="card stat"><span class="muted">Suplanuota (${fmtDate(viewWeek)} sav.)</span><b class="big">${eur(totals.totals[totals.cheapest])}</b><span class="small muted">pigiausiai – ${storeName(totals.cheapest)}</span></div>
    <div class="card stat"><span class="muted">Vidurkis per savaitę</span><b class="big">${eur(avg)}</b><span class="small muted">${avg ? eur(avg / 7 / Math.max(1, st.people)) + ' žm./d.' : 'dar nėra duomenų'}</span></div>
  </section>
  <section class="card">
    <div class="card-head">
      <h2>Kur išleidžiama?</h2>
      <div class="seg">${[['week', 'Savaitė'], ['month', 'Mėnuo'], ['all', 'Viskas']].map(([k, l]) => `<button class="${statsPeriod === k ? 'active' : ''}" data-action="stats-period" data-p="${k}">${l}</button>`).join('')}</div>
    </div>
    ${catBars(spentByCategory(periodExpenses(statsPeriod)))}
  </section>
  <section class="card">
    <h2>Suplanuotas krepšelis (${fmtDate(viewWeek)} sav.)</h2>
    ${catBars(categoryBreakdown(ev.items.filter((i) => i.packs > 0 && !i.staple), w.extras, c, totals.cheapest))}
  </section>
  <section class="card">
    <h2>Paskutinės 8 savaitės</h2>
    <div class="chart" role="img" aria-label="Išlaidos per savaitę">
      <div class="plot">
        ${st.budget ? `<div class="budget-line" style="bottom:${(st.budget / maxV) * 100}%"><span>biudžetas ${eur(st.budget)}</span></div>` : ''}
        ${weeks.map((wk, i) => `<div class="bar-v ${spent[i] > st.budget ? 'over' : ''}" style="height:${(spent[i] / maxV) * 100}%" title="${eur(spent[i])}"></div>`).join('')}
      </div>
      <div class="labels">${weeks.map((wk) => `<span class="small muted">${fmtDate(wk).replace(' d.', '')}</span>`).join('')}</div>
    </div>
  </section>
  <section class="card">
    <h2>Išlaidos</h2>
    <form class="grid-form" data-form="expense">
      <label>Data<input type="date" name="date" value="${today()}" required></label>
      <label>Suma €<input type="number" name="amount" min="0" step="0.01" required></label>
      <label>Parduotuvė<select name="store">${STORES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}<option value="kita">Kita</option></select></label>
      <label>Kategorija<select name="cat"><option value="">Mišrus pirkinys</option>${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <button class="btn primary">Pridėti</button>
    </form>
    <ul class="expenses">${expenses.map((e) => `
      <li><span>${fmtDate(e.date)}</span><span>${esc(storeName(e.store))}${e.note ? ` <small class="muted">${esc(e.note)}</small>` : ''}</span><b>${eur(e.amount)}</b>
      <button class="icon-btn small" data-action="expense-remove" data-id="${e.id}" aria-label="Pašalinti">✕</button></li>`).join('') || '<li class="muted">Dar nėra išlaidų.</li>'}
    </ul>
  </section>`;
}

// ----- Receptai -----

function viewRecipes() {
  const tags = [['all', 'Visi'], ['breakfast', 'Pusryčiai'], ['main', 'Pietūs / vakarienė'], ['veg', '🌱 Vegetariški'], ['fast', '⚡ Greiti'], ['fav', '⭐ Mėgstami'], ['mine', '✍️ Mano']];
  return `
  <header class="page-head"><h1>Receptai</h1></header>
  <div class="toolbar wrap">
    <input type="search" placeholder="Ieškoti…" value="${esc(recipeFilter.q)}" data-input="recipe-search" class="grow" aria-label="Ieškoti receptų">
    <button class="btn primary" data-action="new-recipe">+ Naujas receptas</button>
  </div>
  <div class="chips">${tags.map(([k, l]) => `<button class="chip ${recipeFilter.tag === k ? 'active' : ''}" data-action="recipe-tag" data-tag="${k}">${l}</button>`).join('')}</div>
  <section id="recipe-grid" class="recipe-grid"></section>`;
}

function renderRecipeGrid() {
  const grid = $('#recipe-grid');
  if (!grid) return;
  const c = ctx();
  const q = recipeFilter.q.trim().toLowerCase();
  const list = Object.values(c.recipes).filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !Object.keys(r.ing).some((id) => INGREDIENTS[id]?.name.toLowerCase().includes(q))) return false;
    switch (recipeFilter.tag) {
      case 'breakfast': return r.meals.includes('pusryciai');
      case 'main': return !r.meals.includes('pusryciai');
      case 'veg': return isVegetarian(r);
      case 'fast': return r.time <= 20;
      case 'fav': return c.favorites.has(r.id);
      case 'mine': return !!r.custom;
      default: return true;
    }
  });
  grid.innerHTML = list.map((r) => `
    <article class="recipe-card ${c.disliked.has(r.id) ? 'disliked' : ''}">
      <button class="recipe-open" data-action="recipe" data-id="${r.id}">
        <b>${esc(r.name)}</b>
        <small class="muted">⏱ ${r.time} min · ${r.kcal} kcal · ~${eur(recipeServingCost(r, c))}/porc.</small>
        <small>${isVegetarian(r) ? '🌱 ' : ''}${r.soup ? '🍲 ' : ''}${r.custom ? '✍️ ' : ''}${r.meals.map((m) => SLOT_LABELS[m]).join(', ')}</small>
      </button>
      <div class="recipe-actions">
        <button class="icon-btn" data-action="fav" data-id="${r.id}" title="Mėgstamas" aria-label="Mėgstamas">${c.favorites.has(r.id) ? '⭐' : '☆'}</button>
        <button class="icon-btn" data-action="dislike" data-id="${r.id}" title="Neįtraukti į planą" aria-label="Neįtraukti į planą">${c.disliked.has(r.id) ? '🚫' : '👎'}</button>
      </div>
    </article>`).join('') || '<p class="muted">Nieko nerasta.</p>';
}

let recipeServings = 2;
function openRecipe(id) {
  recipeServings = state.settings.people;
  openModal('Receptas', () => {
    const c = ctx();
    const r = c.recipes[id];
    if (!r) return '<p>Receptas nerastas.</p>';
    return `
      <h3 class="recipe-title">${esc(r.name)}</h3>
      <div class="stepper"><span>Porcijos:</span>
        <button class="icon-btn" data-action="recipe-servings" data-delta="-1">−</button><b>${recipeServings}</b>
        <button class="icon-btn" data-action="recipe-servings" data-delta="1">+</button></div>
      <form class="inline-form" data-form="add-to-plan" data-id="${r.id}">
        <select name="day" aria-label="Diena">${DAY_NAMES.map((n, i) => `<option value="${i}">${n}, ${fmtDate(addDays(viewWeek, i))}</option>`).join('')}</select>
        <select name="slot" aria-label="Valgymas">${r.meals.map((m) => `<option value="${m}">${SLOT_LABELS[m]}</option>`).join('')}</select>
        <button class="btn primary">Į planą</button>
      </form>
      ${recipeDetailHtml(r, recipeServings, c)}
      ${r.custom ? `<div class="toolbar"><button class="btn" data-action="edit-recipe" data-id="${r.id}">Redaguoti</button><button class="btn danger" data-action="delete-recipe" data-id="${r.id}">Ištrinti</button></div>` : ''}`;
  });
}

function recipeFormHtml(r, asWish = false) {
  const rows = Object.entries(r?.ing || { '': '' });
  return `
    <form class="recipe-form" data-form="recipe" data-id="${r?.id || ''}" data-wish="${asWish ? 1 : ''}">
      <label>Pavadinimas<input name="name" required value="${esc(r?.name || '')}"></label>
      <fieldset><legend>Valgymas</legend>
        ${SLOTS.map((s) => `<label class="check"><input type="checkbox" name="meals" value="${s}" ${(r ? r.meals.includes(s) : s !== 'pusryciai') ? 'checked' : ''}> ${SLOT_LABELS[s]}</label>`).join('')}
      </fieldset>
      <div class="row3">
        <label>Laikas (min)<input name="time" type="number" min="1" value="${r?.time || 30}"></label>
        <label>kcal / porc.<input name="kcal" type="number" min="0" value="${r?.kcal || 500}"></label>
        <label>Baltymai g<input name="protein" type="number" min="0" value="${r?.protein || 20}"></label>
      </div>
      <fieldset><legend>Ingredientai vienai porcijai</legend>
        <div data-ing-rows>
          ${rows.map(([id, q]) => ingRowHtml(id, q)).join('')}
        </div>
        <button type="button" class="btn small" data-action="add-ing-row">+ Ingredientas</button>
      </fieldset>
      <label>Gaminimo žingsniai (kiekvienas naujoje eilutėje)<textarea name="steps" rows="4">${esc((r?.steps || []).join('\n'))}</textarea></label>
      <button class="btn primary">Išsaugoti</button>
    </form>`;
}

function ingRowHtml(id = '', q = '') {
  return `<div class="ing-row"><select name="ing">${ingredientOptions(id, { exclude: EXTRA_CATS })}</select><input name="qty" type="number" min="0" step="any" value="${q}" placeholder="kiekis" aria-label="Kiekis"><button type="button" class="icon-btn small" data-action="remove-ing-row" aria-label="Pašalinti">✕</button></div>`;
}

// ----- Nustatymai -----

function viewSettings() {
  const st = state.settings;
  const c = ctx();
  const promos = currentPromos(c);
  const srcs = live?.sources || {};
  return `
  <header class="page-head"><h1>Nustatymai</h1></header>
  <section class="card">
    <h2>Šeima ir planas</h2>
    <div class="grid-form">
      <label>Žmonių skaičius<input type="number" min="1" max="12" value="${st.people}" data-change="setting" data-key="people"></label>
      <label>Savaitės biudžetas €<input type="number" min="0" value="${st.budget}" data-change="setting" data-key="budget"></label>
      <label>Max gaminimo laikas darbo dienomis (min)<input type="number" min="5" step="5" value="${st.maxWeekdayTime}" data-change="setting" data-key="maxWeekdayTime"></label>
    </div>
    <fieldset><legend>Planuojami valgymai</legend>
      ${SLOTS.map((s) => `<label class="check"><input type="checkbox" data-change="meal-toggle" value="${s}" ${st.meals.includes(s) ? 'checked' : ''}> ${SLOT_LABELS[s]}</label>`).join('')}
    </fieldset>
    <label class="check"><input type="checkbox" data-change="setting-bool" data-key="leftovers" ${st.leftovers ? 'checked' : ''}> ♻️ Vakarienės likučiai kitos dienos pietums (mažiau gaminimo ir švaistymo)</label>
    <label class="check"><input type="checkbox" data-change="setting-bool" data-key="vegetarian" ${st.vegetarian ? 'checked' : ''}> 🌱 Tik vegetariški patiekalai</label>
    <label class="check"><input type="checkbox" data-change="setting-bool" data-key="assumeStaples" ${st.assumeStaples ? 'checked' : ''}> Bazinės atsargos (aliejus, druska, miltai, prieskoniai) visada namie</label>
  </section>

  <section class="card">
    <h2>Parduotuvės</h2>
    <p class="small muted">Lyginamos tik pažymėtos parduotuvės.</p>
    <div class="chips">${STORES.map((s) => `<label class="chip check"><input type="checkbox" data-change="store-toggle" value="${s.id}" ${c.stores.includes(s.id) ? 'checked' : ''}> ${s.name}</label>`).join('')}</div>
    <h3>Kainų šaltiniai</h3>
    <ul class="sources">
      ${STORES.map((s) => {
        const info = srcs[s.id];
        const age = info ? daysBetween(info.updatedAt.slice(0, 10), today()) : null;
        return `<li><b>${s.name}</b><span class="muted small">${info ? `atnaujinta ${fmtDate(info.updatedAt.slice(0, 10))}${age > 8 ? ' (pasenę)' : ''} · ${info.found} prekių` : 'apytikslės kainos'}</span>
          <a href="${s.promoUrl}" target="_blank" rel="noopener" class="btn small">Akcijos ↗</a></li>`;
      }).join('')}
    </ul>
    <p class="small muted">Kainos automatiškai surenkamos kasdien iš parduotuvių internetinių katalogų. Jei duomenų nėra, naudojamos apytikslės kainos. Pastebėję akciją leidinyje, įveskite ją žemiau – planas ją iškart įvertins.</p>
  </section>

  <section class="card">
    <h2>🏷️ Akcijos (${promos.length})</h2>
    <form class="grid-form" data-form="promo">
      <label>Produktas<select name="ingId">${ingredientOptions()}</select></label>
      <label>Parduotuvė<select name="store">${STORES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
      <label>Akcijos kaina už pakuotę €<input name="packPrice" type="number" min="0" step="0.01" required></label>
      <label>Galioja iki<input name="until" type="date" value="${addDays(today(), 6)}"></label>
      <button class="btn primary">Pridėti akciją</button>
    </form>
    <ul class="promos">
      ${promos.slice(0, 40).map((p) => {
        const ing = INGREDIENTS[p.ingId];
        const manual = state.promos.find((x) => x.ingId === p.ingId && x.store === p.store);
        return `<li><span><b>${esc(ing.name)}</b><small class="muted">${storeName(p.store)} · ${fmtQty(ing.pack, ing.unit)}${p.until ? ` · iki ${fmtDate(p.until.slice(0, 10))}` : ''}${p.title ? ` · ${esc(p.title)}` : ''}</small></span>
          <span>${p.oldPrice ? `<s class="muted small">${eur(p.oldPrice)}</s> ` : ''}<b>${eur(p.price)}</b>${p.discount ? ` <em class="promo">−${Math.round(p.discount * 100)} %</em>` : ''}</span>
          ${manual ? `<button class="icon-btn small" data-action="promo-remove" data-id="${manual.id}" aria-label="Pašalinti">✕</button>` : p.url ? `<a class="small" href="${esc(p.url)}" target="_blank" rel="noopener">↗</a>` : ''}</li>`;
      }).join('') || '<li class="muted">Šiuo metu akcijų duomenų nėra.</li>'}
    </ul>
  </section>

  <section class="card">
    <h2>Nemėgstami produktai</h2>
    <p class="small muted">Receptai su šiais produktais nebus siūlomi.</p>
    <div class="chips">${st.excluded.map((id) => `<button class="chip active" data-action="unexclude" data-id="${id}">${esc(INGREDIENTS[id]?.name || id)} ✕</button>`).join('') || '<span class="muted small">Nėra</span>'}</div>
    <div class="inline-form"><select data-change="exclude"><option value="">+ Pridėti…</option>${ingredientOptions('', { exclude: EXTRA_CATS })}</select></div>
  </section>

  <details class="card">
    <summary>Kainų redagavimas (pakuotės kaina €)</summary>
    <p class="small muted">Įrašyta kaina turi pirmenybę prieš automatines. Ištrynus reikšmę grįžtama prie automatinės/apytikslės kainos.</p>
    <div class="table-wrap"><table class="prices">
      <thead><tr><th>Produktas</th>${c.stores.map((s) => `<th>${storeName(s)}</th>`).join('')}</tr></thead>
      <tbody>${Object.values(INGREDIENTS).map((ing) => `
        <tr><td>${esc(ing.name)} <small class="muted">${fmtQty(ing.pack, ing.unit)}</small></td>
        ${c.stores.map((s) => {
          const info = c.infoOf(ing.id, s);
          return `<td><input type="number" step="0.01" min="0" class="${info.source}" value="${info.source === 'manual' ? info.price : ''}" placeholder="${num(info.price)}" data-change="price" data-ing="${ing.id}" data-store="${s}" aria-label="${esc(ing.name)} ${storeName(s)}"></td>`;
        }).join('')}</tr>`).join('')}
      </tbody>
    </table></div>
  </details>

  <section class="card">
    <h2>Išvaizda ir duomenys</h2>
    <label>Tema<select data-change="setting-str" data-key="theme">
      ${[['light', '☀️ Šviesi'], ['dark', '🌙 Tamsi'], ['auto', 'Pagal įrenginio nustatymus']].map(([v, l]) => `<option value="${v}" ${st.theme === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></label>
    ${cloud.ref
      ? '<p class="small sync-ok">☁️ Duomenys sinchronizuojami per jūsų claude.ai paskyrą – tie patys planai matomi telefone ir kompiuteryje.</p>'
      : '<p class="small muted">Duomenys saugomi tik šiame įrenginyje. Norėdami perkelti į kitą įrenginį (pvz. iš kompiuterio į telefoną), eksportuokite ir importuokite failą.</p>'}
    <div class="toolbar wrap">
      <button class="btn" data-action="export">⬇️ Eksportuoti</button>
      <button class="btn" data-action="export-copy">📋 Kopijuoti duomenis</button>
      <label class="btn">⬆️ Importuoti<input type="file" accept="application/json" data-change="import" hidden></label>
      <button class="btn danger" data-action="reset">Ištrinti viską</button>
    </div>
  </section>`;
}

// ---------- Veiksmai ----------

const actions = {
  'close-modal': closeModal,
  'confirm-yes': () => {
    const fn = pendingConfirm;
    pendingConfirm = null;
    closeModal();
    if (fn) fn();
  },
  'wish-remove': (el) => {
    const w = week();
    w.wishes = w.wishes.filter((id) => id !== el.dataset.id);
    // Pašaliname ir iš plano (jei neužrakintas ir nepagamintas).
    w.plan.days.forEach((day) => {
      for (const s of SLOTS) if (day[s]?.wish && day[s].recipeId === el.dataset.id && !day[s].cooked) delete day[s];
    });
    syncLeftovers(w.plan);
    regenerate();
    render();
  },
  'wish-add': (el) => {
    const w = week();
    w.wishes = [...new Set([...w.wishes, el.dataset.id])];
    regenerate();
    render();
    toast('Pridėta ir įtraukta į planą');
  },
  'wish-create': (el) => {
    const name = el.dataset.name;
    openModal('Naujas receptas', () => recipeFormHtml({ name, meals: ['pietus', 'vakariene'], time: 45, kcal: 600, protein: 20, ing: { '': '' }, steps: [] }, true));
  },
  'pick-day': (el) => {
    selectedDay = +el.dataset.d;
    render();
  },
  week: (el) => {
    selectedDay = null;
    viewWeek = addDays(viewWeek, 7 * Number(el.dataset.dir));
    render();
  },
  generate: () => {
    const btn = $('[data-action="generate"]');
    if (btn) btn.disabled = true;
    setTimeout(() => {
      regenerate();
      render();
      toast('Planas sudarytas ✨');
    }, 20);
  },
  'clear-plan': () =>
    askConfirm('Išvalyti planą?', 'Bus pašalinti visi šios savaitės patiekalai, išskyrus jau pagamintus.', 'Išvalyti', () => {
      const w = week();
      w.plan.days = w.plan.days.map((day) => Object.fromEntries(Object.entries(day).filter(([, e]) => e.cooked)));
      syncLeftovers(w.plan);
      save();
      render();
    }),
  meal: (el) => openMeal(+el.dataset.d, el.dataset.s),
  alts: (el) => openAlternatives(+el.dataset.d, el.dataset.s),
  'set-recipe': (el) => {
    const d = +el.dataset.d;
    const s = el.dataset.s;
    const plan = week().plan;
    const prev = plan.days[d][s];
    plan.days[d][s] = { recipeId: el.dataset.id, servings: prev?.servings || state.settings.people, locked: prev?.locked };
    syncLeftovers(plan);
    save();
    render();
    openMeal(d, s);
  },
  servings: (el) => {
    const e = week().plan.days[+el.dataset.d][el.dataset.s];
    e.servings = Math.max(1, (e.servings || 1) + Number(el.dataset.delta));
    save();
    render();
  },
  lock: (el) => {
    const e = week().plan.days[+el.dataset.d][el.dataset.s];
    e.locked = !e.locked;
    save();
    render();
  },
  skip: (el) => {
    const plan = week().plan;
    plan.days[+el.dataset.d][el.dataset.s] = { skip: true, locked: true };
    syncLeftovers(plan);
    save();
    closeModal();
    render();
  },
  'meal-remove': (el) => {
    const plan = week().plan;
    delete plan.days[+el.dataset.d][el.dataset.s];
    syncLeftovers(plan);
    save();
    closeModal();
    render();
  },
  unleftover: (el) => {
    const d = +el.dataset.d;
    const plan = week().plan;
    delete plan.days[d].pietus;
    syncLeftovers(plan);
    save();
    openAlternatives(d, 'pietus');
    render();
  },
  cooked: (el) => {
    const e = week().plan.days[+el.dataset.d][el.dataset.s];
    const r = ctx().recipes[e.recipeId];
    if (!e.cooked) {
      e.cooked = true;
      if (!e.leftover && r) state.pantry = consumeFromPantry(state.pantry, r, (e.servings || 0) + (e.extra || 0));
      toast('Pažymėta kaip pagaminta – produktai nurašyti iš šaldytuvo');
    } else {
      e.cooked = false;
      toast('Atšaukta (šaldytuvo kiekius pataisykite rankiniu būdu)');
    }
    save();
    render();
  },
  'select-store': (el) => {
    state.settings.selectedStore = el.dataset.store;
    save();
    render();
  },
  'find-nearby': findNearby,
  have: (el) => {
    const it = planSummary().ev.items.find((i) => i.ingId === el.dataset.id);
    if (!it) return;
    const ing = INGREDIENTS[it.ingId];
    state.pantry.push({ id: uid(), ingId: it.ingId, qty: it.toBuy, expiry: addDays(today(), Math.min(ing.shelf, 365)) });
    delete week().checked[it.ingId];
    save();
    render();
    toast(`${ing.name} – pažymėta, kad turite. Kiekį ir galiojimą galite pataisyti skiltyje „Šaldytuvas“.`);
  },
  'extra-qty': (el) => {
    const x = week().extras.find((e) => e.id === el.dataset.id);
    if (!x) return;
    x.qty = Math.max(1, x.qty + Number(el.dataset.delta));
    save();
    render();
  },
  'extra-remove': (el) => {
    const w = week();
    w.extras = w.extras.filter((x) => x.id !== el.dataset.id);
    save();
    render();
  },
  'share-list': async () => {
    const { ev, w } = planSummary();
    const lines = [`Pirkinių sąrašas (${fmtDate(viewWeek)} sav.)`, ''];
    for (const [k, label] of Object.entries(CATEGORIES)) {
      const items = ev.items.filter((i) => i.cat === k && i.packs > 0 && !i.staple && !w.checked[i.ingId]);
      if (!items.length) continue;
      lines.push(label.toUpperCase());
      for (const i of items) lines.push(`☐ ${i.name} – ${fmtPacks(i.packs, INGREDIENTS[i.ingId])}`);
      lines.push('');
    }
    const ex = w.extras.filter((x) => !x.checked);
    if (ex.length) lines.push('GĖRIMAI IR KITA', ...ex.map((x) => (x.ingId ? `☐ ${INGREDIENTS[x.ingId].name} – ${x.qty} vnt.` : `☐ ${x.name}`)));
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Pirkinių sąrašas', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Sąrašas nukopijuotas');
      }
    } catch {
      // vartotojas atšaukė
    }
  },
  'finish-shopping': () => {
    const { c, ev, totals, w } = planSummary();
    const sel = selectedStore(c, totals);
    const picked = ev.items.filter((i) => i.packs > 0 && !i.staple && w.checked[i.ingId]);
    const est = picked.reduce((s, i) => s + (sel === 'pair' ? i.prices[totals.bestPair.assign[i.ingId]] : i.prices[sel] || 0), 0)
      + w.extras.filter((x) => x.checked).reduce((s, x) => s + (x.price || 0), 0);
    openModal('Baigti apsipirkimą', () => `
      <form class="grid-form" data-form="finish">
        <label>Kiek sumokėjote? €<input name="amount" type="number" min="0" step="0.01" value="${est.toFixed(2)}" required></label>
        <label>Parduotuvė<select name="store">${STORES.map((s) => `<option value="${s.id}" ${s.id === (sel === 'pair' ? totals.bestPair.stores[0] : sel) ? 'selected' : ''}>${s.name}</option>`).join('')}<option value="kita">Kita</option></select></label>
        <label class="check full"><input type="checkbox" name="toPantry" checked> Perkelti ${picked.length} paimtas prekes į šaldytuvą</label>
        <button class="btn primary">Išsaugoti</button>
      </form>`);
  },
  'stats-period': (el) => {
    statsPeriod = el.dataset.p;
    render();
  },
  'pantry-remove': (el) => {
    state.pantry = state.pantry.filter((p) => p.id !== el.dataset.id);
    save();
    render();
  },
  'expense-remove': (el) => {
    state.expenses = state.expenses.filter((e) => e.id !== el.dataset.id);
    save();
    render();
  },
  recipe: (el) => openRecipe(el.dataset.id),
  'recipe-servings': (el) => {
    recipeServings = Math.max(1, recipeServings + Number(el.dataset.delta));
    refreshModal();
  },
  'recipe-tag': (el) => {
    recipeFilter.tag = el.dataset.tag;
    render();
  },
  fav: (el) => toggleIn('favorites', el.dataset.id),
  dislike: (el) => toggleIn('disliked', el.dataset.id),
  'new-recipe': () => openModal('Naujas receptas', () => recipeFormHtml(null)),
  'edit-recipe': (el) => {
    const r = state.customRecipes.find((x) => x.id === el.dataset.id);
    openModal('Redaguoti receptą', () => recipeFormHtml(r));
  },
  'delete-recipe': (el) => {
    const id = el.dataset.id;
    askConfirm('Ištrinti receptą?', 'Receptas bus ištrintas visam laikui.', 'Ištrinti', () => {
      state.customRecipes = state.customRecipes.filter((x) => x.id !== id);
      save();
      render();
    });
  },
  'add-ing-row': () => $('[data-ing-rows]').insertAdjacentHTML('beforeend', ingRowHtml()),
  'remove-ing-row': (el) => el.closest('.ing-row').remove(),
  unexclude: (el) => {
    state.settings.excluded = state.settings.excluded.filter((x) => x !== el.dataset.id);
    save();
    render();
  },
  'promo-remove': (el) => {
    state.promos = state.promos.filter((p) => p.id !== el.dataset.id);
    save();
    render();
  },
  export: async () => {
    const filename = `maisto-planas-${today()}.json`;
    if (cloud.downloads) {
      try {
        await cloud.downloads.save({ filename, data: JSON.stringify(state, null, 1) });
      } catch (e) {
        if (e?.code !== 'declined') toast('Nepavyko išsaugoti failo');
      }
      return;
    }
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `maisto-planas-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'export-copy': async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state));
      toast('Duomenys nukopijuoti – įklijuokite į failą .json');
    } catch {
      toast('Nepavyko nukopijuoti – naudokite „Eksportuoti“');
    }
  },
  reset: () =>
    askConfirm('Ištrinti visus duomenis?', 'Bus ištrinti planai, šaldytuvo turinys, išlaidos ir savi receptai šiame įrenginyje.', 'Ištrinti viską', () => {
      state = defaultState();
      save();
      applyTheme();
      render();
    }),
};

function toggleIn(key, id) {
  const set = new Set(state[key]);
  set.has(id) ? set.delete(id) : set.add(id);
  state[key] = [...set];
  save();
  render();
}

const changes = {
  check: (el) => {
    const w = week();
    if (el.checked) w.checked[el.dataset.id] = true;
    else delete w.checked[el.dataset.id];
    save();
    render();
  },
  'check-extra': (el) => {
    const x = week().extras.find((e) => e.id === el.dataset.id);
    if (x) x.checked = el.checked;
    save();
    render();
  },
  setting: (el) => {
    const v = Number(el.value);
    if (!Number.isFinite(v) || v < 0) return;
    state.settings[el.dataset.key] = el.dataset.key === 'people' ? Math.max(1, Math.round(v)) : v;
    save();
    render();
  },
  'setting-bool': (el) => {
    state.settings[el.dataset.key] = el.checked;
    save();
    render();
  },
  'setting-str': (el) => {
    state.settings[el.dataset.key] = el.value;
    applyTheme();
    save();
  },
  'meal-toggle': (el) => {
    const set = new Set(state.settings.meals);
    el.checked ? set.add(el.value) : set.delete(el.value);
    state.settings.meals = SLOTS.filter((s) => set.has(s));
    save();
    render();
  },
  'store-toggle': (el) => {
    const set = new Set(ctx().stores);
    el.checked ? set.add(el.value) : set.delete(el.value);
    if (!set.size) {
      toast('Palikite bent vieną parduotuvę');
      return render();
    }
    state.settings.stores = STORES.map((s) => s.id).filter((id) => set.has(id));
    save();
    render();
  },
  exclude: (el) => {
    if (!el.value) return;
    state.settings.excluded = [...new Set([...state.settings.excluded, el.value])];
    save();
    render();
  },
  price: (el) => {
    const k = `${el.dataset.ing}|${el.dataset.store}`;
    const v = parseFloat(el.value);
    if (el.value === '' || !Number.isFinite(v)) delete state.priceOverrides[k];
    else state.priceOverrides[k] = v;
    save();
  },
  'pantry-ing': (el) => {
    const ing = INGREDIENTS[el.value];
    const form = el.form;
    $('[data-unit]', form).textContent = ing.unit;
    form.qty.value = ing.pack;
    form.expiry.value = addDays(today(), Math.min(ing.shelf, 365));
  },
  'pantry-qty': (el) => {
    const p = state.pantry.find((x) => x.id === el.dataset.id);
    const v = parseFloat(el.value);
    if (!p || !Number.isFinite(v)) return;
    if (v <= 0) state.pantry = state.pantry.filter((x) => x !== p);
    else p.qty = v;
    save();
    render();
  },
  import: async (el) => {
    const file = el.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('bad');
      state = mergeDefaults(data);
      save();
      applyTheme();
      render();
      toast('Duomenys importuoti');
    } catch {
      toast('Netinkamas failas');
    }
  },
};

const normalizeName = (t) => String(t).trim().toLowerCase();

const forms = {
  wishes: (f) => {
    const text = f.text.value;
    const w = week();
    const { matched, unmatched } = matchWishes(text, ctx().recipes);
    w.wishes = [...new Set([...w.wishes, ...matched.map((m) => m.recipe.id)])];
    w.unmatched = [...new Set([...(w.unmatched || []), ...unmatched])];
    if (matched.length) regenerate();
    save();
    render();
    if (matched.length) toast(matched.length === 1 ? `Įtraukta: ${matched[0].recipe.name}` : `Įtraukta į planą: ${matched.length} patiekalai`);
    else if (unmatched.length) toast('Tokio recepto neradau – galite jį sukurti');
  },
  extra: (f) => {
    week().extras.push({ id: uid(), name: f.name.value.trim(), price: parseFloat(f.price.value) || 0, checked: false });
    save();
    render();
  },
  'extra-catalog': (f) => {
    const w = week();
    const qty = Math.max(1, parseInt(f.qty.value, 10) || 1);
    const existing = w.extras.find((x) => x.ingId === f.ingId.value && !x.checked);
    if (existing) existing.qty += qty;
    else w.extras.push({ id: uid(), ingId: f.ingId.value, qty, checked: false });
    save();
    render();
  },
  pantry: (f) => {
    const qty = parseFloat(f.qty.value);
    if (!(qty > 0)) return;
    state.pantry.push({ id: uid(), ingId: f.ingId.value, qty, expiry: f.expiry.value || null });
    save();
    render();
    toast('Pridėta į šaldytuvą');
  },
  expense: (f) => {
    const amount = parseFloat(f.amount.value) || 0;
    state.expenses.push({ id: uid(), date: f.date.value, amount, store: f.store.value, cats: f.cat.value ? { [f.cat.value]: amount } : null });
    save();
    render();
  },
  promo: (f) => {
    const ingId = f.ingId.value;
    const store = f.store.value;
    state.promos = state.promos.filter((p) => !(p.ingId === ingId && p.store === store));
    const oldPrice = ctx().infoOf(ingId, store).price;
    state.promos.push({ id: uid(), ingId, store, packPrice: parseFloat(f.packPrice.value), oldPrice, until: f.until.value || null });
    save();
    render();
    toast('Akcija pridėta – perplanuokite, kad ji būtų įvertinta');
  },
  finish: (f) => {
    const { c, ev, w } = planSummary();
    const amount = parseFloat(f.amount.value) || 0;
    if (amount > 0) {
      // Išskaidome sumokėtą sumą pagal paimtų prekių kategorijas (proporcingai jų kainoms).
      const picked = ev.items.filter((i) => w.checked[i.ingId] && i.packs > 0 && !i.staple);
      const raw = categoryBreakdown(picked, w.extras.filter((x) => x.checked), c, f.store.value);
      const sum = Object.values(raw).reduce((a, b) => a + b, 0);
      const cats = sum > 0 ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round((v / sum) * amount * 100) / 100])) : null;
      state.expenses.push({ id: uid(), date: today(), amount, store: f.store.value, cats });
    }
    if (f.toPantry.checked) {
      for (const it of ev.items) {
        if (!w.checked[it.ingId] || it.packs <= 0) continue;
        const ing = INGREDIENTS[it.ingId];
        state.pantry.push({ id: uid(), ingId: it.ingId, qty: it.packs * ing.pack, expiry: addDays(today(), Math.min(ing.shelf, 365)) });
      }
    }
    w.checked = {};
    w.extras = w.extras.filter((x) => !x.checked);
    save();
    closeModal();
    render();
    toast('Apsipirkimas išsaugotas 👍');
  },
  'add-to-plan': (f) => {
    const d = +f.day.value;
    const plan = week().plan;
    plan.days[d][f.slot.value] = { recipeId: f.dataset.id, servings: recipeServings, locked: true };
    syncLeftovers(plan);
    save();
    closeModal();
    toast(`Įtraukta: ${DAY_NAMES[d]}`);
    render();
  },
  recipe: (f) => {
    const meals = [...f.querySelectorAll('[name="meals"]:checked')].map((x) => x.value);
    if (!meals.length) return toast('Pasirinkite bent vieną valgymą');
    const ing = {};
    for (const row of f.querySelectorAll('.ing-row')) {
      const id = row.querySelector('select').value;
      const q = parseFloat(row.querySelector('input').value);
      if (id && q > 0) ing[id] = (ing[id] || 0) + q;
    }
    if (!Object.keys(ing).length) return toast('Pridėkite bent vieną ingredientą');
    if (!f.name.value.trim()) return toast('Įveskite pavadinimą');
    const id = f.dataset.id || 'mano_' + uid();
    const r = {
      id,
      custom: true,
      name: f.name.value.trim(),
      meals,
      time: +f.time.value || 30,
      kcal: +f.kcal.value || 0,
      protein: +f.protein.value || 0,
      ing,
      steps: f.steps.value.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    state.customRecipes = [...state.customRecipes.filter((x) => x.id !== id), r];
    if (f.dataset.wish) {
      const w = week();
      w.wishes = [...new Set([...w.wishes, id])];
      w.unmatched = (w.unmatched || []).filter((t) => normalizeName(t) !== normalizeName(r.name));
      regenerate();
      save();
      closeModal();
      render();
      return toast('Receptas sukurtas ir įtrauktas į planą');
    }
    save();
    render();
    openRecipe(id);
    toast('Receptas išsaugotas');
  },
};

// ---------- Įvykiai ----------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) {
    ev.preventDefault();
    fn(el, ev);
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el, ev);
});

document.addEventListener('input', (ev) => {
  if (ev.target.dataset.input === 'recipe-search') {
    recipeFilter.q = ev.target.value;
    renderRecipeGrid();
  }
});

document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('[data-form]');
  if (!f || !forms[f.dataset.form]) return;
  ev.preventDefault();
  forms[f.dataset.form](f);
});

$('#modal').addEventListener('close', () => (modalRender = null));
$('#modal').addEventListener('click', (ev) => {
  if (ev.target === ev.currentTarget) closeModal(); // paspaudimas už lango ribų
});

window.addEventListener('hashchange', () => {
  render();
  $('#view').focus({ preventScroll: true });
  window.scrollTo(0, 0);
});

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

async function loadLivePrices() {
  try {
    const res = await fetch('data/prices.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.stores && Object.keys(data.stores).length) {
      live = data;
      render();
    }
  } catch {
    // be interneto – naudojamos apytikslės kainos
  }
}

// Seni tušti savaičių įrašai užima vietą – išvalome senesnius nei 12 savaičių.
function pruneOldWeeks() {
  const cutoff = addDays(mondayOf(new Date()), -84);
  for (const k of Object.keys(state.weeks)) if (k < cutoff) delete state.weeks[k];
}

pruneOldWeeks();
applyTheme();
render();
loadLivePrices();
initCloud();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Naudojama testuose / derinant konsolėje.
window.__app = { get state() { return state; }, allRecipes: () => allRecipes(state) };

// Būsenos saugojimas naršyklės localStorage (duomenys lieka tik šiame įrenginyje).
const KEY = 'maisto-planas-v1';

export function defaultState() {
  return {
    version: 1,
    updatedAt: 0,
    settings: {
      people: 2,
      budget: 70,
      meals: ['pusryciai', 'pietus', 'vakariene'],
      vegetarian: false,
      leftovers: true,
      maxWeekdayTime: 45,
      stores: ['lidl', 'norfa', 'maxima', 'iki', 'rimi'],
      excluded: [],
      assumeStaples: true,
      theme: 'light',
      selectedStore: null,
    },
    weeks: {}, // 'YYYY-MM-DD' (pirmadienis) -> { plan, checked: {}, extras: [], wishes: [] }
    pantry: [], // { id, ingId, qty, expiry }
    expenses: [], // { id, date, amount, store, note }
    customRecipes: [],
    favorites: [],
    disliked: [],
    priceOverrides: {}, // 'ingId|store' -> pakuotės kaina €
    promos: [], // rankiniu būdu įvestos akcijos: { id, ingId, store, packPrice, oldPrice, until, note }
    nearby: null,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return mergeDefaults(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function mergeDefaults(data) {
  const def = defaultState();
  return { ...def, ...data, settings: { ...def.settings, ...(data.settings || {}) } };
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

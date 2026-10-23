// Produktų pavadinimų atitikimas paieškos taisyklėms (naudoja kainų rinkimas ir čekių skaitymas).

// Gyvūnų ėdalas ir panašūs dažnai patenka į paiešką („lašiša katėms“) – atmetame visada.
export const GLOBAL_NOT = ['katėms', 'kačių', 'kač.', 'šunims', 'šunų', 'ėd.', 'ėdalas', 'gyvūn', 'kūdikių', 'kūdik', 'vaikų košė', 'skonio', 'mėn.)', 'nuo 6 mėn', 'nuo 4 mėn', 'nuo 8 mėn'];

/**
 * Jei parduotuvė nenurodo vieneto kainos, ją apskaičiuojame iš pavadinime nurodyto kiekio
 * („PIEMENĖLIO pienas, 0,5 l“ → 1,30 €/l). Kiekiai kaip „4x85g“ dauginami.
 */
export function withUnitPrice(p) {
  if (p.unitPrice > 0 || !(p.price > 0)) return p;
  const t = String(p.title || '').toLowerCase().replace(/,/g, '.');
  const all = [...t.matchAll(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b(?:\s*[x×]\s*(\d+))?/g)];
  const m = all[all.length - 1];
  if (m) {
    const mult = (m[1] ? Number(m[1]) : 1) * (m[4] ? Number(m[4]) : 1);
    let qty = Number(m[2]) * mult;
    const u = m[3];
    if (u === 'g' || u === 'ml') qty /= 1000;
    if (qty > 0) return { ...p, unitPrice: Math.round((p.price / qty) * 100) / 100, unit: u === 'g' || u === 'kg' ? 'kg' : 'l' };
  }
  const pcs = t.match(/(\d+)\s*vnt/);
  if (pcs && Number(pcs[1]) > 0) return { ...p, unitPrice: Math.round((p.price / Number(pcs[1])) * 1000) / 1000, unit: 'vnt' };
  return p;
}

// `must` – bent vienas fragmentas; `all` – visi fragmentai; `not` – nė vieno; `re` – pavadinimas atitinka (pvz. tūris).
// Fragmentas turi prasidėti žodžio pradžioje („alus“ neturi sutapti su „natūrALUS“).
export const wordStart = (t, w) => {
  let i = t.indexOf(w);
  while (i >= 0) {
    if (i === 0 || !/[a-ząčęėįšųūž0-9]/.test(t[i - 1])) return true;
    i = t.indexOf(w, i + 1);
  }
  return false;
};

export function matches(title, term) {
  const t = String(title || '').toLowerCase();
  if (GLOBAL_NOT.some((w) => t.includes(w))) return false;
  if (term.must && !term.must.some((w) => wordStart(t, w))) return false;
  if (term.all && !term.all.every((w) => wordStart(t, w))) return false;
  if (term.not && term.not.some((w) => t.includes(w))) return false;
  if (term.re && !term.re.test(t)) return false;
  return true;
}


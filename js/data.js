// Bazinė programėlės informacija: parduotuvės, produktai, receptai.
// Kainos yra APYTIKSLĖS (2026 m. LT vidurkiai) ir gali būti koreguojamos nustatymuose.

// `promoUrl` – parduotuvės akcijų / leidinių puslapis; `live` – ar kainos renkamos automatiškai; Norfa – tik akcijos (scripts/fetch-prices.mjs).
export const STORES = [
  { id: 'lidl', name: 'Lidl', factor: 0.93, match: /lidl/i, color: '#0050aa', promoUrl: 'https://www.lidl.lt/c/savaites-pasiulymai/a10022071', live: true },
  { id: 'norfa', name: 'Norfa', factor: 0.95, match: /norfa/i, color: '#e2001a', promoUrl: 'https://www.norfa.lt/akcijos/', live: true },
  { id: 'maxima', name: 'Maxima', factor: 1.0, match: /maxima|barbora/i, color: '#d4202a', promoUrl: 'https://www.maxima.lt/pasiulymai', live: true },
  { id: 'iki', name: 'Iki', factor: 1.03, match: /\biki\b/i, color: '#e30613', promoUrl: 'https://www.iki.lt/akcijos/', live: true },
  { id: 'rimi', name: 'Rimi', factor: 1.05, match: /rimi/i, color: '#e4002b', promoUrl: 'https://www.rimi.lt/akcijos', live: true },
];

export const CATEGORIES = {
  darzoves: 'Daržovės ir vaisiai',
  mesa: 'Mėsa ir žuvis',
  pienas: 'Pieno produktai ir kiaušiniai',
  kruopos: 'Kruopos, makaronai, miltai',
  duona: 'Duona',
  konservai: 'Konservai ir padažai',
  saldyti: 'Šaldyti produktai',
  bazine: 'Prieskoniai ir aliejus',
  gerimai: 'Gėrimai',
  kita: 'Užkandžiai ir kita',
};

// Kategorijos, kurių prekės nenaudojamos receptuose, o perkamos papildomai (gėrimai, užkandžiai).
export const EXTRA_CATS = ['gerimai', 'kita'];

// [id, pavadinimas, kategorija, vienetas, pakuotės dydis, bazinė pakuotės kaina €, galiojimas dienomis, bazinė atsarga?]
const RAW_INGREDIENTS = [
  ['bulves', 'Bulvės', 'darzoves', 'g', 2000, 1.49, 30],
  ['morkos', 'Morkos', 'darzoves', 'g', 1000, 0.89, 21],
  ['svogunai', 'Svogūnai', 'darzoves', 'g', 1000, 0.99, 30],
  ['cesnakai', 'Česnakai', 'darzoves', 'g', 100, 0.79, 30],
  ['kopustai', 'Baltagūžis kopūstas', 'darzoves', 'g', 1500, 1.19, 21],
  ['burokeliai', 'Burokėliai', 'darzoves', 'g', 1000, 0.89, 30],
  ['pomidorai', 'Pomidorai', 'darzoves', 'g', 500, 1.99, 6],
  ['agurkai', 'Agurkai', 'darzoves', 'g', 500, 1.49, 7],
  ['paprikos', 'Paprikos', 'darzoves', 'g', 500, 2.49, 8],
  ['brokoliai', 'Brokoliai', 'darzoves', 'g', 500, 1.99, 5],
  ['cukinija', 'Cukinija', 'darzoves', 'g', 500, 1.29, 7],
  ['grybai', 'Pievagrybiai', 'darzoves', 'g', 500, 2.29, 5],
  ['salotos', 'Lapinės salotos', 'darzoves', 'g', 150, 1.29, 4],
  ['zalumynai', 'Krapai / petražolės', 'darzoves', 'g', 30, 0.69, 5],
  ['obuoliai', 'Obuoliai', 'darzoves', 'g', 1000, 1.29, 21],
  ['bananai', 'Bananai', 'darzoves', 'g', 1000, 1.39, 6],
  ['citrinos', 'Citrina', 'darzoves', 'vnt', 1, 0.35, 21],

  ['vistienos_file', 'Vištienos krūtinėlės filė', 'mesa', 'g', 1000, 6.99, 3],
  ['vistienos_slauneles', 'Vištienos šlaunelės', 'mesa', 'g', 1000, 4.49, 3],
  ['malta_mesa', 'Malta kiauliena-jautiena', 'mesa', 'g', 500, 3.49, 2],
  ['kiauliena', 'Kiaulienos sprandinė', 'mesa', 'g', 1000, 6.49, 3],
  ['desreles', 'Dešrelės', 'mesa', 'g', 400, 2.49, 10],
  ['kumpis', 'Virtas kumpis', 'mesa', 'g', 150, 1.79, 7],
  ['lasisa', 'Lašišos filė', 'mesa', 'g', 250, 4.99, 2],
  ['sonine', 'Rūkyta šoninė', 'mesa', 'g', 300, 2.99, 21],
  ['silke', 'Silkės filė (aliejuje)', 'mesa', 'g', 250, 2.49, 14],
  ['koldunai', 'Koldūnai su mėsa (šaldyti)', 'saldyti', 'g', 1000, 4.49, 180],

  ['pienas', 'Pienas 2,5%', 'pienas', 'ml', 1000, 1.09, 7],
  ['kefyras', 'Kefyras', 'pienas', 'ml', 1000, 1.19, 7],
  ['kiausiniai', 'Kiaušiniai', 'pienas', 'vnt', 10, 2.29, 21],
  ['varske', 'Varškė 9%', 'pienas', 'g', 400, 2.19, 7],
  ['grietine', 'Grietinė 30%', 'pienas', 'g', 400, 1.59, 10],
  ['jogurtas', 'Natūralus jogurtas', 'pienas', 'g', 400, 1.29, 10],
  ['suris', 'Fermentinis sūris', 'pienas', 'g', 250, 2.99, 21],
  ['sviestas', 'Sviestas', 'pienas', 'g', 200, 2.69, 30],
  ['grietinele', 'Grietinėlė', 'pienas', 'ml', 200, 1.29, 10],

  ['avizos', 'Avižiniai dribsniai', 'kruopos', 'g', 500, 0.99, 180],
  ['grikiai', 'Grikiai', 'kruopos', 'g', 800, 1.49, 365],
  ['ryziai', 'Ryžiai', 'kruopos', 'g', 1000, 1.69, 365],
  ['makaronai', 'Makaronai', 'kruopos', 'g', 500, 0.99, 365],
  ['miltai', 'Kvietiniai miltai', 'kruopos', 'g', 1000, 0.79, 365, true],
  ['krakmolas', 'Bulvių krakmolas', 'kruopos', 'g', 400, 1.19, 365],
  ['lesiai', 'Raudonieji lęšiai', 'kruopos', 'g', 500, 1.79, 365],

  ['duona', 'Ruginė duona', 'duona', 'g', 800, 1.59, 5],
  ['batonas', 'Batonas', 'duona', 'g', 500, 1.09, 4],
  ['tortilijos', 'Tortilijos', 'duona', 'vnt', 6, 1.79, 14],

  ['pomidorai_konserv', 'Konservuoti pomidorai', 'konservai', 'g', 400, 0.89, 365],
  ['pupeles', 'Konservuotos raudonosios pupelės', 'konservai', 'g', 400, 0.79, 365],
  ['avinzirniai', 'Konservuoti avinžirniai', 'konservai', 'g', 400, 0.89, 365],
  ['tunas', 'Tunas savose sultyse', 'konservai', 'g', 160, 1.69, 365],
  ['medus', 'Medus', 'konservai', 'g', 250, 3.49, 365],
  ['soju_padazas', 'Sojų padažas', 'konservai', 'ml', 150, 1.49, 365, true],

  ['menke', 'Menkės filė (šaldyta)', 'saldyti', 'g', 400, 3.99, 90],
  ['zirneliai', 'Žalieji žirneliai (šaldyti)', 'saldyti', 'g', 400, 1.29, 180],
  ['darzoviu_misinys', 'Daržovių mišinys (šaldytas)', 'saldyti', 'g', 400, 1.49, 180],
  ['uogos', 'Uogų mišinys (šaldytas)', 'saldyti', 'g', 300, 2.29, 180],

  ['aliejus', 'Saulėgrąžų aliejus', 'bazine', 'ml', 1000, 2.19, 365, true],
  ['druska', 'Druska', 'bazine', 'g', 1000, 0.39, 999, true],
  ['cukrus', 'Cukrus', 'bazine', 'g', 1000, 0.99, 999, true],
  ['pipirai', 'Malti pipirai', 'bazine', 'g', 50, 1.19, 999, true],
  ['paprika_malta', 'Malta paprika', 'bazine', 'g', 50, 0.99, 999, true],
  ['kario', 'Kario prieskoniai', 'bazine', 'g', 50, 1.09, 999, true],

  ['alus', 'Alus (0,5 l skardinė)', 'gerimai', 'vnt', 1, 1.09, 180],
  ['alus_nealk', 'Nealkoholinis alus (0,5 l)', 'gerimai', 'vnt', 1, 1.15, 180],
  ['sidras', 'Sidras (0,5 l)', 'gerimai', 'vnt', 1, 1.39, 180],
  ['vynas', 'Vynas (0,75 l)', 'gerimai', 'vnt', 1, 5.99, 365],
  ['vanduo', 'Mineralinis vanduo (1,5 l)', 'gerimai', 'vnt', 1, 0.59, 365],
  ['sultys', 'Sultys (1 l)', 'gerimai', 'vnt', 1, 1.79, 180],
  ['gaivusis', 'Gaivusis gėrimas (1,5 l)', 'gerimai', 'vnt', 1, 1.49, 180],
  ['gira', 'Gira (1,5 l)', 'gerimai', 'vnt', 1, 1.39, 60],
  ['kava', 'Malta kava (500 g)', 'gerimai', 'vnt', 1, 6.49, 365],
  ['arbata', 'Arbata (20 pakelių)', 'gerimai', 'vnt', 1, 1.69, 365],
  ['traskuciai', 'Bulvių traškučiai', 'kita', 'vnt', 1, 1.69, 180],
  ['sokoladas', 'Šokoladas (100 g)', 'kita', 'vnt', 1, 1.29, 180],
  ['sausainiai', 'Sausainiai', 'kita', 'vnt', 1, 1.49, 180],
  ['riesutai', 'Riešutai (200 g)', 'kita', 'vnt', 1, 2.99, 180],
  ['ledai', 'Ledai (1 l)', 'kita', 'vnt', 1, 3.49, 180],
];

export const INGREDIENTS = Object.fromEntries(
  RAW_INGREDIENTS.map(([id, name, cat, unit, pack, base, shelf, staple]) => [
    id,
    { id, name, cat, unit, pack, base, shelf, staple: !!staple },
  ]),
);

// Deterministinis nedidelis kainų skirtumas tarp parduotuvių (±7 %), kad palyginimas būtų realistiškesnis.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function defaultPrice(ingId, storeId) {
  const ing = INGREDIENTS[ingId];
  const store = STORES.find((s) => s.id === storeId);
  if (!ing || !store) return null;
  const variation = (hash(ingId + '|' + storeId) - 0.5) * 0.14;
  return Math.round(ing.base * store.factor * (1 + variation) * 100) / 100;
}

const P = ['pusryciai'];
const M = ['pietus', 'vakariene'];

export const RECIPES = [
  // --- Pusryčiai ---
  {
    id: 'avizine_kose', name: 'Avižinė košė su obuoliu ir medumi', meals: P, time: 10, kcal: 380, protein: 12,
    ing: { avizos: 60, pienas: 200, obuoliai: 80, medus: 10, druska: 1 },
    steps: ['Užvirinkite pieną su žiupsneliu druskos.', 'Suberkite dribsnius ir virkite 5 min. maišydami.', 'Patiekite su tarkuotu obuoliu ir medumi.'],
  },
  {
    id: 'kiausinene', name: 'Kiaušinienė su pomidorais ir duona', meals: P, time: 10, kcal: 420, protein: 20,
    ing: { kiausiniai: 2, pomidorai: 100, duona: 60, sviestas: 10, druska: 1, pipirai: 0.5 },
    steps: ['Ištirpinkite sviestą keptuvėje.', 'Įmuškite kiaušinius, kepkite 3–4 min.', 'Patiekite su pomidorais ir duona.'],
  },
  {
    id: 'varskeciai', name: 'Varškėčiai su grietine', meals: P, time: 25, kcal: 450, protein: 28,
    ing: { varske: 130, kiausiniai: 0.5, miltai: 30, cukrus: 10, aliejus: 10, grietine: 40 },
    steps: ['Sumaišykite varškę, kiaušinį, cukrų ir miltus.', 'Suformuokite paplotėlius, apvoliokite miltuose.', 'Kepkite aliejuje po 3 min. iš abiejų pusių, patiekite su grietine.'],
  },
  {
    id: 'jogurtas_uogos', name: 'Jogurtas su uogomis ir dribsniais', meals: P, time: 5, kcal: 320, protein: 13,
    ing: { jogurtas: 200, uogos: 80, avizos: 30, medus: 10 },
    steps: ['Atšildykite uogas (galima vakare šaldytuve).', 'Sluoksniuokite jogurtą, uogas ir dribsnius, apšlakstykite medumi.'],
  },
  {
    id: 'sumustiniai', name: 'Sumuštiniai su sūriu, kumpiu ir agurku', meals: P, time: 5, kcal: 430, protein: 22,
    ing: { duona: 80, sviestas: 10, suris: 30, kumpis: 40, agurkai: 60 },
    steps: ['Patepkite duoną sviestu.', 'Uždėkite sūrio, kumpio ir agurko griežinėlių.'],
  },
  {
    id: 'omletas', name: 'Omletas su paprika ir sūriu', meals: P, time: 15, kcal: 350, protein: 22,
    ing: { kiausiniai: 2, pienas: 50, paprikos: 60, suris: 20, aliejus: 5, druska: 1 },
    steps: ['Išplakite kiaušinius su pienu ir druska.', 'Apkepinkite papriką, užpilkite kiaušinių mase.', 'Pabarstykite sūriu ir kepkite uždengę 5 min.'],
  },
  {
    id: 'blynai', name: 'Blynai su uogomis', meals: P, time: 25, kcal: 430, protein: 12,
    ing: { miltai: 60, pienas: 150, kiausiniai: 0.5, cukrus: 10, aliejus: 10, uogos: 60 },
    steps: ['Išplakite pieną, kiaušinius, cukrų ir miltus į skystą tešlą.', 'Kepkite plonus blynus įkaitintoje keptuvėje.', 'Patiekite su uogomis.'],
  },
  {
    id: 'kokteilis', name: 'Bananų ir avižų kokteilis', meals: P, time: 5, kcal: 350, protein: 12,
    ing: { bananai: 120, pienas: 250, avizos: 30, medus: 5 },
    steps: ['Sudėkite viską į trintuvą ir sutrinkite iki vientisos masės.'],
  },
  {
    id: 'grikiai_pienas', name: 'Grikių košė su sviestu ir kiaušiniu', meals: P, time: 20, kcal: 400, protein: 16,
    ing: { grikiai: 70, sviestas: 10, kiausiniai: 1, druska: 1 },
    steps: ['Išvirkite grikius pasūdytame vandenyje (15 min.).', 'Išvirkite kiaušinį.', 'Patiekite su sviestu ir kiaušiniu.'],
  },

  // --- Pietūs / vakarienė ---
  {
    id: 'bulviniai_blynai', name: 'Bulviniai blynai su grietine', meals: M, time: 40, kcal: 560, protein: 12,
    ing: { bulves: 300, kiausiniai: 0.5, miltai: 20, svogunai: 30, aliejus: 20, grietine: 50, druska: 2 },
    steps: ['Sutarkuokite bulves ir svogūną, nusunkite skystį.', 'Įmaišykite kiaušinį, miltus, druską.', 'Kepkite aliejuje iki auksinės spalvos, patiekite su grietine.'],
  },
  {
    id: 'vistiena_ryziai', name: 'Vištiena su ryžiais ir daržovėmis', meals: M, time: 30, kcal: 560, protein: 42,
    ing: { vistienos_file: 150, ryziai: 80, darzoviu_misinys: 150, soju_padazas: 15, aliejus: 10, cesnakai: 5 },
    steps: ['Išvirkite ryžius.', 'Supjaustytą vištieną apkepkite su česnaku.', 'Suberkite daržoves, troškinkite 7 min., įpilkite sojų padažo.'],
  },
  {
    id: 'bolonese', name: 'Makaronai su mėsos ir pomidorų padažu', meals: M, time: 35, kcal: 680, protein: 35,
    ing: { makaronai: 100, malta_mesa: 125, pomidorai_konserv: 130, svogunai: 40, morkos: 40, cesnakai: 4, aliejus: 10, suris: 15 },
    steps: ['Apkepinkite svogūną, morką ir česnaką.', 'Sudėkite faršą, kepkite kol paruduos.', 'Supilkite pomidorus, troškinkite 15 min.', 'Patiekite su makaronais ir tarkuotu sūriu.'],
  },
  {
    id: 'barsciai', name: 'Burokėlių sriuba (barščiai)', meals: M, time: 50, kcal: 280, protein: 6, soup: true,
    ing: { burokeliai: 150, bulves: 120, morkos: 40, svogunai: 30, kopustai: 60, grietine: 30, zalumynai: 3, aliejus: 5, druska: 2 },
    steps: ['Apkepinkite svogūną ir morką.', 'Virkite bulves 10 min., sudėkite burokėlius ir kopūstus.', 'Virkite dar 15 min., pagardinkite.', 'Patiekite su grietine ir krapais.'],
  },
  {
    id: 'saltibarsciai', name: 'Šaltibarščiai su karštomis bulvėmis', meals: M, time: 30, kcal: 420, protein: 20, soup: true,
    ing: { kefyras: 300, burokeliai: 100, agurkai: 80, kiausiniai: 1, zalumynai: 5, bulves: 200, druska: 1 },
    steps: ['Išvirkite burokėlius, kiaušinius ir bulves.', 'Sutarkuokite burokėlius ir agurkus, supjaustykite krapus.', 'Užpilkite kefyru, patiekite su bulvėmis ir kiaušiniu.'],
  },
  {
    id: 'lesiu_sriuba', name: 'Lęšių sriuba su kariu', meals: M, time: 35, kcal: 420, protein: 20, soup: true,
    ing: { lesiai: 70, morkos: 50, svogunai: 40, pomidorai_konserv: 100, cesnakai: 4, kario: 2, aliejus: 10, duona: 50, druska: 1 },
    steps: ['Apkepinkite svogūną, morką, česnaką ir kario prieskonius.', 'Suberkite lęšius, pomidorus, užpilkite vandeniu.', 'Virkite 20 min., sutrinkite. Patiekite su duona.'],
  },
  {
    id: 'kiaulienos_troskinys', name: 'Kiaulienos troškinys su bulvėmis', meals: M, time: 75, kcal: 650, protein: 33,
    ing: { kiauliena: 150, bulves: 250, morkos: 60, svogunai: 50, paprika_malta: 2, aliejus: 10, druska: 2 },
    steps: ['Apkepkite mėsos gabaliukus.', 'Sudėkite svogūnus, morkas, papriką, užpilkite vandeniu.', 'Troškinkite 40 min., sudėkite bulves ir troškinkite dar 20 min.'],
  },
  {
    id: 'slauneles_orkaiteje', name: 'Orkaitėje keptos šlaunelės su bulvėmis', meals: M, time: 60, kcal: 680, protein: 38,
    ing: { vistienos_slauneles: 220, bulves: 250, morkos: 80, aliejus: 15, cesnakai: 4, paprika_malta: 2, druska: 2 },
    steps: ['Supjaustykite bulves ir morkas, sumaišykite su aliejumi ir prieskoniais.', 'Sudėkite šlauneles ant daržovių.', 'Kepkite 200 °C orkaitėje 45 min.'],
  },
  {
    id: 'lasisa_brokoliai', name: 'Lašiša su brokoliais ir ryžiais', meals: M, time: 30, kcal: 600, protein: 34,
    ing: { lasisa: 140, brokoliai: 150, ryziai: 70, citrinos: 0.25, sviestas: 10, druska: 1 },
    steps: ['Išvirkite ryžius.', 'Lašišą kepkite orkaitėje 200 °C 15 min. su citrina.', 'Brokolius apvirkite 4 min., patiekite su sviestu.'],
  },
  {
    id: 'menke_kose', name: 'Kepta menkė su bulvių koše ir žirneliais', meals: M, time: 35, kcal: 520, protein: 36,
    ing: { menke: 170, bulves: 250, pienas: 50, sviestas: 10, zirneliai: 80, miltai: 10, aliejus: 10, druska: 2 },
    steps: ['Išvirkite bulves ir sutrinkite su pienu ir sviestu.', 'Menkę apvoliokite miltuose ir apkepkite.', 'Apvirkite žirnelius ir patiekite kartu.'],
  },
  {
    id: 'grikiai_grybai', name: 'Grikiai su pievagrybių padažu', meals: M, time: 30, kcal: 480, protein: 15,
    ing: { grikiai: 80, grybai: 150, svogunai: 40, grietinele: 50, sviestas: 10, druska: 1 },
    steps: ['Išvirkite grikius.', 'Apkepinkite svogūną ir grybus svieste.', 'Įpilkite grietinėlės, pavirkite 3 min. ir patiekite.'],
  },
  {
    id: 'kopustai_desreles', name: 'Troškinti kopūstai su dešrelėmis', meals: M, time: 40, kcal: 520, protein: 18,
    ing: { kopustai: 250, desreles: 100, morkos: 50, svogunai: 40, pomidorai_konserv: 60, aliejus: 10, duona: 50, druska: 1 },
    steps: ['Supjaustykite kopūstą, morką ir svogūną.', 'Troškinkite su pomidorais 25 min.', 'Sudėkite supjaustytas dešreles ir pašildykite.'],
  },
  {
    id: 'avinzirniu_karis', name: 'Avinžirnių ir daržovių karis su ryžiais', meals: M, time: 30, kcal: 560, protein: 18,
    ing: { avinzirniai: 130, pomidorai_konserv: 100, svogunai: 40, paprikos: 70, kario: 3, ryziai: 70, aliejus: 10, druska: 1 },
    steps: ['Išvirkite ryžius.', 'Apkepinkite svogūną, papriką ir kario prieskonius.', 'Sudėkite avinžirnius ir pomidorus, troškinkite 15 min.'],
  },
  {
    id: 'tortilijos', name: 'Vištienos tortilijos su daržovėmis', meals: M, time: 25, kcal: 580, protein: 40,
    ing: { tortilijos: 2, vistienos_file: 120, pomidorai: 60, agurkai: 50, salotos: 25, jogurtas: 40, cesnakai: 2, aliejus: 5 },
    steps: ['Apkepkite vištienos juosteles.', 'Jogurtą sumaišykite su česnaku – gausite padažą.', 'Suvyniokite vištieną ir daržoves į tortilijas.'],
  },
  {
    id: 'vistienos_sriuba', name: 'Vištienos sriuba su makaronais', meals: M, time: 50, kcal: 340, protein: 22, soup: true,
    ing: { vistienos_slauneles: 120, morkos: 50, svogunai: 30, bulves: 100, makaronai: 25, zalumynai: 3, druska: 2 },
    steps: ['Išvirkite sultinį iš šlaunelių (30 min.).', 'Sudėkite bulves, morkas, svogūną ir virkite 10 min.', 'Suberkite makaronus, virkite dar 7 min., pabarstykite krapais.'],
  },
  {
    id: 'maltinukai', name: 'Maltinukai su bulvių koše ir agurkais', meals: M, time: 45, kcal: 720, protein: 36,
    ing: { malta_mesa: 150, kiausiniai: 0.3, batonas: 20, svogunai: 30, aliejus: 15, bulves: 250, pienas: 50, sviestas: 10, agurkai: 80, druska: 2 },
    steps: ['Sumaišykite faršą, kiaušinį, mirkytą batoną ir svogūną.', 'Suformuokite maltinukus ir kepkite po 5 min. iš abiejų pusių.', 'Išvirkite bulvių košę, patiekite su agurkais.'],
  },
  {
    id: 'cukinijos_makaronai', name: 'Makaronai su cukinija ir sūriu', meals: M, time: 20, kcal: 600, protein: 20,
    ing: { makaronai: 100, cukinija: 150, cesnakai: 5, grietinele: 50, suris: 25, aliejus: 10, druska: 1 },
    steps: ['Išvirkite makaronus.', 'Apkepinkite cukiniją su česnaku.', 'Įpilkite grietinėlės, sumaišykite su makaronais ir sūriu.'],
  },
  {
    id: 'tuno_salotos', name: 'Tuno salotos su kiaušiniu', meals: M, time: 15, kcal: 430, protein: 32,
    ing: { tunas: 80, kiausiniai: 1, salotos: 40, pomidorai: 80, agurkai: 80, aliejus: 10, duona: 50 },
    steps: ['Išvirkite kiaušinius.', 'Supjaustykite daržoves, sudėkite tuną ir kiaušinius.', 'Apšlakstykite aliejumi, patiekite su duona.'],
  },
  {
    id: 'cili', name: 'Čili su pupelėmis ir ryžiais', meals: M, time: 35, kcal: 650, protein: 36,
    ing: { malta_mesa: 100, pupeles: 130, pomidorai_konserv: 120, svogunai: 40, paprikos: 50, paprika_malta: 2, ryziai: 60, aliejus: 5 },
    steps: ['Apkepinkite svogūną ir faršą.', 'Sudėkite papriką, pupeles, pomidorus ir prieskonius.', 'Troškinkite 20 min., patiekite su ryžiais.'],
  },
  {
    id: 'plovas', name: 'Plovas su kiauliena', meals: M, time: 60, kcal: 650, protein: 30,
    ing: { kiauliena: 130, ryziai: 80, morkos: 80, svogunai: 40, cesnakai: 5, aliejus: 15, druska: 2 },
    steps: ['Apkepkite mėsą, sudėkite svogūną ir šiaudeliais pjaustytas morkas.', 'Suberkite ryžius, užpilkite vandeniu, įdėkite česnakus.', 'Troškinkite uždengę ant mažos ugnies 30 min.'],
  },
  // --- Lietuviški patiekalai ---
  {
    id: 'kugelis', name: 'Kugelis su spirgučiais ir grietine', meals: M, time: 90, kcal: 720, protein: 18,
    aliases: ['bulviu plokstainis', 'bulvių plokštainis'],
    ing: { bulves: 400, sonine: 50, svogunai: 50, kiausiniai: 0.5, pienas: 80, grietine: 50, druska: 2, pipirai: 0.5 },
    steps: ['Apkepinkite supjaustytą šoninę su svogūnais.', 'Smulkiai sutarkuokite bulves, užpilkite karštu pienu.', 'Įmaišykite kiaušinius, spirgučius, druską, pipirus.', 'Kepkite riebalais pateptoje formoje 180 °C ~70 min.', 'Patiekite su grietine.'],
  },
  {
    id: 'cepelinai', name: 'Cepelinai su mėsa ir spirgučių padažu', meals: M, time: 100, kcal: 780, protein: 26,
    aliases: ['didzkukuliai', 'didžkukuliai'],
    ing: { bulves: 450, krakmolas: 15, malta_mesa: 80, svogunai: 50, sonine: 40, grietine: 60, druska: 2, pipirai: 0.5 },
    steps: ['Dalį bulvių išvirkite ir sutrinkite, likusias sutarkuokite ir nuspauskite.', 'Sumaišykite masę su krakmolu ir druska.', 'Faršą pagardinkite svogūnu, pipirais.', 'Suformuokite cepelinus su įdaru, virkite pasūdytame vandenyje 25 min.', 'Patiekite su spirgučių, svogūnų ir grietinės padažu.'],
  },
  {
    id: 'zemaiciu_blynai', name: 'Žemaičių blynai su grietine', meals: M, time: 60, kcal: 690, protein: 26,
    ing: { bulves: 300, malta_mesa: 90, svogunai: 30, krakmolas: 10, aliejus: 20, grietine: 50, druska: 2 },
    steps: ['Išvirkite bulves ir sutrinkite į košę, įmaišykite krakmolo.', 'Faršą sumaišykite su svogūnu ir prieskoniais.', 'Iš košės suformuokite paplotėlius su mėsos įdaru.', 'Kepkite aliejuje iki auksinės spalvos, patiekite su grietine.'],
  },
  {
    id: 'balandeliai', name: 'Balandėliai pomidorų padaže', meals: M, time: 80, kcal: 560, protein: 28,
    aliases: ['balandeliai', 'kopustu suktinukai'],
    ing: { kopustai: 300, malta_mesa: 120, ryziai: 40, svogunai: 30, morkos: 40, pomidorai_konserv: 120, grietine: 30, druska: 2 },
    steps: ['Kopūsto lapus apvirkite, kad suminkštėtų.', 'Faršą sumaišykite su apvirtais ryžiais ir svogūnu.', 'Suvyniokite įdarą į lapus.', 'Sudėkite į puodą, užpilkite pomidorais su morkomis ir troškinkite 45 min.'],
  },
  {
    id: 'koldunai', name: 'Koldūnai su grietine ir krapais', meals: M, time: 15, kcal: 620, protein: 24,
    aliases: ['virtiniai', 'koldunai'],
    ing: { koldunai: 250, grietine: 50, zalumynai: 3, sviestas: 10 },
    steps: ['Virkite koldūnus pasūdytame vandenyje, kol iškils, ir dar 3 min.', 'Patiekite su sviestu, grietine ir krapais.'],
  },
  {
    id: 'silke_bulves', name: 'Silkė su bulvėmis ir svogūnais', meals: M, time: 30, kcal: 540, protein: 22,
    ing: { silke: 100, bulves: 250, svogunai: 40, grietine: 30, zalumynai: 3, druska: 1 },
    steps: ['Išvirkite bulves su lupenomis.', 'Silkę supjaustykite, apibarstykite svogūnais.', 'Patiekite su bulvėmis, grietine ir krapais.'],
  },
  {
    id: 'vistienos_kotletai', name: 'Vištienos kotletai su grikiais ir agurkais', meals: M, time: 40, kcal: 600, protein: 40,
    ing: { vistienos_file: 150, kiausiniai: 0.3, svogunai: 20, batonas: 15, aliejus: 15, grikiai: 70, agurkai: 80, druska: 1 },
    steps: ['Vištieną smulkiai sukapokite, sumaišykite su kiaušiniu, svogūnu, mirkytu batonu.', 'Kepkite kotletus po 5 min. iš abiejų pusių.', 'Patiekite su grikiais ir agurkais.'],
  },
  {
    id: 'varskes_apkepas', name: 'Varškės apkepas su obuoliais', meals: M, time: 50, kcal: 480, protein: 30,
    ing: { varske: 150, kiausiniai: 1, cukrus: 15, avizos: 20, obuoliai: 100, grietine: 30 },
    steps: ['Sumaišykite varškę, kiaušinius, cukrų ir dribsnius.', 'Sudėkite obuolių skilteles, supilkite į formą.', 'Kepkite 180 °C 35 min., patiekite su grietine.'],
  },
];

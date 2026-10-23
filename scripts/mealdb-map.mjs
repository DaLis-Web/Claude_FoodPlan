// TheMealDB ingredientų (anglų k.) susiejimas su programėlės produktais ir kiekių perskaičiavimas.

// Ingredientai, kurių nepirksime atskirai (vanduo, sultinys iš kubelio ir pan.) – nemažina atitikimo.
export const IGNORE = new Set([
  'water', 'ice', 'cold water', 'warm water', 'boiling water', 'hot water', 'chicken stock', 'beef stock', 'vegetable stock',
  'stock', 'chicken stock cube', 'beef stock cube', 'vegetable stock cube', 'stock cube', 'salt', 'sea salt', 'black pepper',
  'pepper', 'ground black pepper', 'white pepper', 'bay leaf', 'bay leaves', 'oil', 'vegetable oil', 'olive oil', 'sunflower oil',
  'extra virgin olive oil', 'cooking spray',
]);

// Prieskoniai ir smulkūs priedai: neskaičiuojami į atitikimą, bet parodomi recepte kaip „Papildomai prireiks“.
export const MINOR = /(nutmeg|cumin|coriander|cinnamon|oregano|thyme|basil|rosemary|sage|mint|savoury|tarragon|chilli|chili|cayenne|garam masala|turmeric|ginger|cardamom|clove(?!s? garlic)|allspice|mixed herbs|herbes|italian seasoning|seasoning|garlic powder|onion powder|baking powder|bicarbonate|baking soda|yeast|vinegar|worcestershire|tabasco|sriracha|hot sauce|wine|beer|celery|capers|olives|vanilla|stock|bouillon|gravy|lime|zest|sesame|parsley flakes|black pudding|horseradish)/;

// Kai kuriuos IGNORE ingredientus vis tiek įtraukiame į bazines atsargas (kad būtų sąraše „patikrinkite namuose“).
export const STAPLE_MAP = {
  salt: 'druska', 'sea salt': 'druska', 'black pepper': 'pipirai', pepper: 'pipirai', 'ground black pepper': 'pipirai',
  oil: 'aliejus', 'vegetable oil': 'aliejus', 'olive oil': 'aliejus', 'sunflower oil': 'aliejus', 'extra virgin olive oil': 'aliejus',
};

export const EN_MAP = {
  'chicken breast': 'vistienos_file', 'chicken breasts': 'vistienos_file', chicken: 'vistienos_file', 'chicken fillets': 'vistienos_file',
  'chicken thighs': 'vistienos_slauneles', 'chicken legs': 'vistienos_slauneles', 'chicken thigh': 'vistienos_slauneles', 'chicken drumsticks': 'vistienos_slauneles',
  'minced beef': 'malta_mesa', 'beef mince': 'malta_mesa', 'ground beef': 'malta_mesa', 'minced pork': 'malta_mesa', 'pork mince': 'malta_mesa', mince: 'malta_mesa', 'lean minced beef': 'malta_mesa',
  beef: 'jautiena', 'beef brisket': 'jautiena', 'stewing beef': 'jautiena', 'beef cutlet': 'jautiena', 'braising steak': 'jautiena', 'beef fillet': 'jautiena',
  'sirloin steak': 'jautiena', 'rump steak': 'jautiena', 'beef shin': 'jautiena', 'chuck steak': 'jautiena',
  mayonnaise: 'majonezas', mustard: 'garstycios', 'dijon mustard': 'garstycios', 'english mustard': 'garstycios', 'wholegrain mustard': 'garstycios',
  'green beans': 'sparagines_pupeles', 'ground pork': 'malta_mesa', 'ground lamb': 'malta_mesa', 'russet potato': 'bulves', 'russet potatoes': 'bulves',
  'red potatoes': 'bulves', fettuccine: 'makaronai', 'egg yolk': 'kiausiniai', 'smoked ham': 'kumpis', 'cheddar': 'suris',
  pork: 'kiauliena', 'pork shoulder': 'kiauliena', 'pork chops': 'kiauliena', 'pork loin': 'kiauliena', 'pork belly': 'sonine',
  bacon: 'sonine', 'smoked bacon': 'sonine', pancetta: 'sonine', lardons: 'sonine', 'streaky bacon': 'sonine', 'bacon rashers': 'sonine',
  sausages: 'desreles', sausage: 'desreles', frankfurters: 'desreles', ham: 'kumpis', 'cooked ham': 'kumpis',
  salmon: 'lasisa', 'beef steak': 'jautiena', 'salmon fillets': 'lasisa', 'salmon fillet': 'lasisa', cod: 'menke', 'cod fillets': 'menke', 'white fish': 'menke', 'white fish fillets': 'menke', haddock: 'menke',
  tuna: 'tunas', 'tinned tuna': 'tunas', 'canned tuna': 'tunas', herring: 'silke',
  potatoes: 'bulves', potato: 'bulves', 'new potatoes': 'bulves', 'floury potatoes': 'bulves', 'baby new potatoes': 'bulves', 'maris piper potatoes': 'bulves',
  carrots: 'morkos', carrot: 'morkos', onion: 'svogunai', onions: 'svogunai', 'red onion': 'svogunai', 'red onions': 'svogunai', 'white onion': 'svogunai', shallots: 'svogunai', 'spring onions': 'zalumynai',
  garlic: 'cesnakai', 'garlic clove': 'cesnakai', 'garlic cloves': 'cesnakai', cabbage: 'kopustai', 'white cabbage': 'kopustai', 'savoy cabbage': 'kopustai',
  beetroot: 'burokeliai', beetroots: 'burokeliai', tomatoes: 'pomidorai', tomato: 'pomidorai', 'cherry tomatoes': 'pomidorai', 'plum tomatoes': 'pomidorai',
  'chopped tomatoes': 'pomidorai_konserv', 'tinned tomatoes': 'pomidorai_konserv', 'canned tomatoes': 'pomidorai_konserv', 'diced tomatoes': 'pomidorai_konserv',
  passata: 'pomidoru_padazas', 'tomato puree': 'pomidoru_padazas', 'tomato sauce': 'pomidoru_padazas', 'tomato passata': 'pomidoru_padazas', 'tomato paste': 'pomidoru_padazas',
  cucumber: 'agurkai', 'red pepper': 'paprikos', 'green pepper': 'paprikos', 'yellow pepper': 'paprikos', 'red peppers': 'paprikos', 'bell pepper': 'paprikos', peppers: 'paprikos',
  broccoli: 'brokoliai', courgettes: 'cukinija', courgette: 'cukinija', zucchini: 'cukinija', mushrooms: 'grybai', mushroom: 'grybai', 'chestnut mushrooms': 'grybai', 'button mushrooms': 'grybai',
  lettuce: 'salotos', 'little gem lettuce': 'salotos', 'romaine lettuce': 'salotos', 'mixed salad leaves': 'salotos', spinach: 'spinatai', 'baby spinach': 'spinatai',
  parsley: 'zalumynai', dill: 'zalumynai', chives: 'zalumynai', 'flat leaf parsley': 'zalumynai',
  apples: 'obuoliai', apple: 'obuoliai', 'bramley apples': 'obuoliai', banana: 'bananai', bananas: 'bananai', lemon: 'citrinos', lemons: 'citrinos', 'lemon juice': 'citrinos', 'lemon zest': 'citrinos',
  milk: 'pienas', 'whole milk': 'pienas', 'semi-skimmed milk': 'pienas', eggs: 'kiausiniai', egg: 'kiausiniai', 'egg yolks': 'kiausiniai', 'egg white': 'kiausiniai', 'free-range eggs': 'kiausiniai',
  butter: 'sviestas', 'unsalted butter': 'sviestas', 'salted butter': 'sviestas', 'sour cream': 'grietine', 'creme fraiche': 'grietine', 'crème fraîche': 'grietine',
  yogurt: 'jogurtas', 'greek yogurt': 'jogurtas', 'natural yogurt': 'jogurtas', 'plain yogurt': 'jogurtas',
  'cheddar cheese': 'suris', cheese: 'suris', 'grated cheese': 'suris', 'gruyère': 'suris', gruyere: 'suris', mozzarella: 'mocarela', 'mozzarella balls': 'mocarela',
  parmesan: 'parmezanas', 'parmesan cheese': 'parmezanas', 'parmigiano-reggiano': 'parmezanas', 'grana padano': 'parmezanas', feta: 'feta', 'feta cheese': 'feta',
  'double cream': 'grietinele', 'heavy cream': 'grietinele', 'single cream': 'grietinele', cream: 'grietinele', 'whipping cream': 'grietinele',
  'cottage cheese': 'varske', 'ricotta': 'varske', kefir: 'kefyras',
  oats: 'avizos', 'rolled oats': 'avizos', 'porridge oats': 'avizos', rice: 'ryziai', 'basmati rice': 'ryziai', 'long grain rice': 'ryziai', 'risotto rice': 'ryziai', 'arborio rice': 'ryziai', 'white rice': 'ryziai', 'jasmine rice': 'ryziai',
  pasta: 'makaronai', spaghetti: 'makaronai', 'penne rigate': 'makaronai', penne: 'makaronai', macaroni: 'makaronai', fusilli: 'makaronai', linguine: 'makaronai', tagliatelle: 'makaronai', farfalle: 'makaronai', 'egg noodles': 'makaronai', noodles: 'makaronai', rigatoni: 'makaronai',
  'lasagne sheets': 'lazanijos_lakstai', buckwheat: 'grikiai',
  flour: 'miltai', 'plain flour': 'miltai', 'self-raising flour': 'miltai', 'all purpose flour': 'miltai', 'bread flour': 'miltai', cornflour: 'krakmolas', 'potato starch': 'krakmolas',
  'red lentils': 'lesiai', lentils: 'lesiai', 'split peas': 'zirniai_skaldyti', 'yellow split peas': 'zirniai_skaldyti',
  bread: 'duona', 'rye bread': 'duona', baguette: 'batonas', breadcrumbs: 'batonas', 'white bread': 'batonas', 'sourdough bread': 'duona',
  tortillas: 'tortilijos', 'flour tortilla': 'tortilijos', 'tortilla wraps': 'tortilijos', 'burger buns': 'mesainiu_bandeles', 'bread rolls': 'mesainiu_bandeles', 'pizza dough': 'picos_tesla',
  'kidney beans': 'pupeles', 'red kidney beans': 'pupeles', 'black beans': 'pupeles', 'baked beans': 'pupeles', 'cannellini beans': 'pupeles', 'butter beans': 'pupeles',
  chickpeas: 'avinzirniai', sweetcorn: 'kukuruzai', corn: 'kukuruzai', 'frozen peas': 'zirneliai', peas: 'zirneliai', 'mixed vegetables': 'darzoviu_misinys',
  'frozen berries': 'uogos', blueberries: 'uogos', raspberries: 'uogos', strawberries: 'uogos',
  honey: 'medus', 'soy sauce': 'soju_padazas', 'dark soy sauce': 'soju_padazas', 'light soy sauce': 'soju_padazas',
  sugar: 'cukrus', 'caster sugar': 'cukrus', 'brown sugar': 'cukrus', 'granulated sugar': 'cukrus', 'light brown soft sugar': 'cukrus',
  paprika: 'paprika_malta', 'smoked paprika': 'paprika_malta', 'curry powder': 'kario', 'mild curry powder': 'kario',
  ...STAPLE_MAP,
};

// Apytikslis vieneto svoris gramais (kai nurodyta „2 onions“, „1 large carrot“ ir pan.).
const PIECE_G = {
  svogunai: 150, morkos: 80, bulves: 180, pomidorai: 120, paprikos: 150, cukinija: 250, agurkai: 250, obuoliai: 150, bananai: 120,
  vistienos_file: 170, jautiena: 200, vistienos_slauneles: 130, lasisa: 140, menke: 150, cesnakai: 5, brokoliai: 350, kopustai: 1200, burokeliai: 150,
  salotos: 150, grybai: 20, desreles: 60, sonine: 25, kiauliena: 180, zalumynai: 10, mocarela: 125, batonas: 30, duona: 35,
};

const UNIT_G = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28, lb: 454, lbs: 454, pound: 454, pounds: 454 };
const UNIT_ML = { ml: 1, l: 1000, litre: 1000, liter: 1000, litres: 1000, tbsp: 15, tbs: 15, tablespoon: 15, tablespoons: 15, tblsp: 15, tsp: 5, teaspoon: 5, teaspoons: 5, cup: 240, cups: 240, pint: 568, dash: 1, pinch: 0.5, splash: 10, handful: 30 };

function parseNumber(s) {
  let t = s.trim().replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4').replace(/⅓/g, ' 1/3');
  const m = t.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?/);
  if (!m || (!m[1] && !m[2])) return null;
  let v = m[1] ? Number(m[1]) : 0;
  if (m[2]) v += Number(m[2]) / Number(m[3]);
  return v || null;
}

/** Kiekis produkto vienetais (g, ml arba vnt) iš TheMealDB „measure“ teksto. */
export function convertMeasure(measure, ing, ingId) {
  const raw = String(measure || '').toLowerCase().replace(/,/g, '.').trim();
  // „Pagal skonį“, „žiupsnelis“, „apšlakstyti“ – nedidelis kiekis.
  if (!/\d/.test(raw) && /taste|season|pinch|dash|drizzle|sprinkl|garnish|serve|splash|little|some|^$/.test(raw)) {
    return ing.unit === 'vnt' ? 1 : /drizzle|splash/.test(raw) ? 10 : 2;
  }
  const n = parseNumber(raw.replace(/^(a|an)\s/, '1 ')) ?? 1;
  const unitM = raw.match(/(?:\d|\s|^)(kg|g|grams?|oz|lbs?|pounds?|ml|l|litres?|liters?|tbsp|tbs|tblsp|tablespoons?|tsp|teaspoons?|cups?|pint|dash|pinch|splash|handful)\b/);
  const unit = unitM?.[1];
  if (ing.unit === 'vnt') return Math.max(0.25, n);
  if (unit && UNIT_G[unit] !== undefined) return n * UNIT_G[unit];
  if (unit && UNIT_ML[unit] !== undefined) {
    // Biriems produktams 1 ml ≈ 0,6–1 g; paprastumo dėlei tankis 0,8 (miltai, cukrus, ryžiai).
    const ml = n * UNIT_ML[unit];
    return ing.unit === 'g' ? ml * 0.8 : ml;
  }
  const piece = PIECE_G[ingId];
  if (piece) {
    const k = /large|big/.test(raw) ? 1.3 : /small/.test(raw) ? 0.7 : 1;
    return n * piece * k;
  }
  return ing.unit === 'ml' ? 100 * n : 100 * n; // nežinomas kiekis – apytiksliai 100 g/ml
}

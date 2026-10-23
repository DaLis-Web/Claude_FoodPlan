// Apytikslė maistinė vertė: [kcal, baltymai g] 100 g / 100 ml arba vienetui (vnt).
// Naudojama receptams, kurių kalorijos nenurodytos (importuoti ar savi receptai).
import { INGREDIENTS } from './data.js';

export const NUTRITION = {
  bulves: [77, 2], morkos: [41, 0.9], svogunai: [40, 1.1], cesnakai: [149, 6.4], kopustai: [25, 1.3], burokeliai: [43, 1.6],
  pomidorai: [18, 0.9], agurkai: [15, 0.7], paprikos: [31, 1], brokoliai: [34, 2.8], cukinija: [17, 1.2], grybai: [22, 3.1],
  salotos: [15, 1.4], zalumynai: [40, 3], obuoliai: [52, 0.3], bananai: [89, 1.1], citrinos: [20, 0.8],
  vistienos_file: [120, 23], vistienos_slauneles: [180, 18], malta_mesa: [260, 17], kiauliena: [240, 17], desreles: [270, 12],
  kumpis: [120, 18], lasisa: [208, 20], sonine: [400, 14], silke: [260, 15], koldunai: [230, 9],
  pienas: [50, 3.3], kefyras: [50, 3.3], kiausiniai: [72, 6.3], varske: [160, 16], grietine: [300, 2.4], jogurtas: [60, 4],
  suris: [350, 25], sviestas: [740, 0.7], grietinele: [200, 2.5], mocarela: [250, 18], parmezanas: [400, 35], feta: [265, 14],
  avizos: [380, 13], grikiai: [343, 13], ryziai: [350, 7], makaronai: [360, 12], miltai: [360, 10], krakmolas: [350, 0.1],
  lesiai: [350, 24], lazanijos_lakstai: [360, 12], zirniai_skaldyti: [340, 24],
  duona: [250, 8], batonas: [270, 8], tortilijos: [140, 4], mesainiu_bandeles: [150, 5], picos_tesla: [250, 8],
  pomidorai_konserv: [25, 1.2], pupeles: [100, 7], avinzirniai: [120, 7], tunas: [110, 25], medus: [304, 0.3],
  soju_padazas: [60, 8], pomidoru_padazas: [35, 1.5], kukuruzai: [80, 2.5],
  menke: [80, 18], zirneliai: [80, 5], darzoviu_misinys: [50, 2.5], uogos: [45, 1], spinatai: [23, 2.9],
  jautiena: [200, 20], majonezas: [680, 1], garstycios: [100, 6], sparagines_pupeles: [31, 1.8],
  aliejus: [880, 0], druska: [0, 0], cukrus: [400, 0], pipirai: [250, 10], paprika_malta: [280, 14], kario: [325, 14],
};

/** Vienos porcijos kalorijos ir baltymai pagal ingredientus. */
export function estimateNutrition(ing) {
  let kcal = 0;
  let protein = 0;
  for (const [id, qty] of Object.entries(ing)) {
    const n = NUTRITION[id];
    const unit = INGREDIENTS[id]?.unit;
    if (!n || !unit) continue;
    const k = unit === 'vnt' ? qty : qty / 100;
    kcal += n[0] * k;
    protein += n[1] * k;
  }
  return { kcal: Math.round(kcal / 10) * 10, protein: Math.round(protein) };
}

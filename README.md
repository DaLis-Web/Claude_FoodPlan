# 🥕 Maisto planas

Savaitės maisto planavimo programėlė telefonui ir kompiuteriui: sudaro valgiaraštį pagal biudžetą ir norus,
skaičiuoja pirkinių sąrašą, lygina **Maxima, Rimi, IKI, Norfa ir Lidl** kainas bei akcijas ir padeda nešvaistyti maisto.

Tai PWA (progresyvi web programėlė): atsidaro naršyklėje, ją galima „įdiegti“ į telefono pradžios ekraną,
ji veikia ir be interneto (pvz. parduotuvėje). Duomenys saugomi tik jūsų įrenginyje.

## Funkcijos

- **📅 Savaitės planas.** Patiekalai sudedami automatiškai pusryčiams, pietums ir vakarienei, nurodytam žmonių skaičiui.
  Optimizuojama kaina, švaistymas (pakuotės sunaudojamos iki galo), įvairovė ir mityba (kcal, baltymai).
  - **Ką norite valgyti?** Įrašykite, pvz., „kugelis, cepelinai“: patiekalai išdėliojami savaitėje
    (ilgai gaminami – savaitgalį), o programa pasiūlo derančius patiekalus, kurie naudoja tuos pačius produktus,
    ir parodo, kiek jie leidžia sutaupyti. Neatpažintą patiekalą galima iškart susikurti kaip receptą.
  - ♻️ Vakarienės likučiai kitos dienos pietums, 🔒 užrakinimas, ✅ „pagaminta“ (produktai nurašomi iš šaldytuvo),
    🍽️ „valgome ne namie“, patiekalo keitimas su papildomos kainos palyginimu.
- **🛒 Pirkinių sąrašas.** Kiekiai suapvalinami iki realių pakuočių, sugrupuoti pagal skyrius, pažymimi kaip paimti.
  - Krepšelio kaina kiekvienoje parduotuvėje, pigiausia parduotuvė ir pigiausias dviejų parduotuvių derinys.
  - 🏷️ Akcijos pažymimos prie prekių.
  - 🏠 „Turiu“: prekė jau yra namie, todėl jos nereikia pirkti.
  - 🥤 Gėrimai ir užkandžiai (alus, vanduo, sultys, kava, vynas…): pridedami su kiekiu, kaina įskaičiuojama.
  - 📍 Artimiausios Maxima / Rimi / IKI / Norfa / Lidl parduotuvės pagal jūsų vietą (OpenStreetMap) su atstumu,
    krepšelio kaina ir nuoroda į maršrutą.
  - Dalinimasis sąrašu (pvz. per Messenger), „Baigti apsipirkimą“: išlaidos įrašomos, prekės perkeliamos į šaldytuvą.
- **🧾 Čekių nuskaitymas.** Nufotografuotas čekis atpažįstamas telefone (Tesseract, lietuvių k.) arba įklijuojamas
  el. čekio tekstas: prekės susiejamos su produktais ir įdedamos į šaldytuvą, išlaidos įrašomos pagal kategorijas,
  o planą galima sudaryti iš to, ką nusipirkote.
- **🧊 Šaldytuvas.** Kas yra namie ir iki kada tinka. Planuojant pirmiausia panaudojama tai, ką jau turite
  (ypač tai, kam baigiasi galiojimas), siūloma, ką pagaminti iš turimų produktų.
- **💶 Biudžetas.** Savaitės biudžetas, išlaidos, 8 savaičių grafikas ir **statistika pagal kategorijas**
  (daržovės, mėsa, pieno produktai, gėrimai…) per savaitę, mėnesį ar visą laiką.
- **📖 Receptai.** 61 receptas su nuotraukomis ir papildomi pasaulio receptai iš TheMealDB (išversti, su kiekiais
  ir kainomis) (įskaitant kugelį, cepelinus, žemaičių blynus, balandėlius, šaltibarščius…),
  paieška, mėgstami ⭐, nemėgstami 👎, savi receptai.
- **⚙️ Nustatymai.** Šviesi arba tamsi tema, vegetariškas režimas, nemėgstami produktai, maksimalus gaminimo laikas
  darbo dienomis, rankinis kainų ir akcijų įvedimas, duomenų eksportas ir importas (perkelti į kitą įrenginį).

## Kainos ir akcijos

Naršyklė negali tiesiogiai skaityti parduotuvių svetainių, todėl kainos surenkamos serveryje:

1. `scripts/fetch-prices.mjs` kiekvienam produktui ieško pigiausio tinkamo atitikmens ir įrašo
   kainas, vieneto kainas, senas kainas ir akcijų požymius į `data/prices.json`:
   - **Maxima**: Barbora e. parduotuvė;
   - **Rimi**: Rimi e. parduotuvė;
   - **IKI**: LastMile;
   - **Lidl**: lidl.lt paieška;
   - **Norfa**: akcijų puslapis (tik akcijinės prekės).
2. GitHub Actions (`.github/workflows/prices.yml`) tai daro kasdien ir išsaugo pakeitimus.
3. Programėlė nuskaito `data/prices.json`. Jei parduotuvės duomenų nėra arba jie senesni nei 8 dienos,
   naudojamos apytikslės kainos, pažymėtos „~“.

Kainos Lietuvos tinkluose visose parduotuvėse paprastai vienodos, todėl „pagal vietovę“ reiškia artimiausią
kiekvieno tinklo parduotuvę ir to tinklo krepšelio kainą.

> ⚠️ Parserių neturėjau galimybės išbandyti su tikromis svetainėmis (kūrimo aplinkoje jos užblokuotos), todėl
> jie išbandyti tik su pavyzdiniais duomenimis. Svetainėms pakeitus struktūrą, parseris nieko neranda ir paliekami
> ankstesni duomenys. Kas veikia, matyti Actions žurnale. Pataisymams pakanka redaguoti `scripts/sources.mjs`.
> Bet kada galite įvesti akciją rankiniu būdu (Nustatymai → Akcijos).

Paleisti rankiniu būdu: `node scripts/fetch-prices.mjs` (arba `--only=rimi --limit=5` bandymui).

## Paleidimas

```bash
npm start          # http://localhost:8080
npm test           # logikos ir parserių testai
```

### Publikavimas GitHub Pages (paprasčiausia)

1. **Settings → General → Danger Zone → Change visibility → Public.**
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**

Programėlė bus `https://dalis-web.github.io/Claude_FoodPlan/` ir atsinaujins po kiekvieno pakeitimo bei
kasdienio kainų rinkimo (`.github/workflows/pages.yml`).

### Publikavimas Hostinger (savas domenas)

Įkėlimą automatiškai atlieka `.github/workflows/deploy.yml`: po kiekvieno pakeitimo ir kasdienio kainų atnaujinimo
programėlė įkeliama per FTP. Vieną kartą reikia:

1. **Hostinger hPanel → Files → FTP Accounts**: susikurkite (arba pasižiūrėkite) FTP paskyrą.
   Jei norite subdomeno (pvz. `maistas.jusudomenas.lt`), pirmiausia sukurkite jį **Domains → Subdomains**
   ir pasižiūrėkite, į kurį aplanką jis rodo.
2. **GitHub → repozitorija → Settings → Secrets and variables → Actions → New repository secret**:
   - `FTP_SERVER`: FTP adresas (pvz. `ftp.jusudomenas.lt` arba IP);
   - `FTP_USERNAME`, `FTP_PASSWORD`;
   - `FTP_DIR` (nebūtina): aplankas, pvz. `public_html/` arba `public_html/maistas/`
     (būtinai su `/` gale).
3. **GitHub → Actions → „Įkelti į Hostinger“ → Run workflow** (arba tiesiog palaukite kito pakeitimo).
4. Hostinger įjunkite **SSL** (nemokamas), kad adresas būtų `https://`. Be jo neveiks vieta ir įdiegimas į telefoną.

Telefone atidarykite adresą ir pasirinkite **„Pridėti prie pradžios ekrano“**. Draugams tiesiog nusiųskite nuorodą:
kiekvieno duomenys saugomi jo paties įrenginyje.

## Struktūra

| Failas | Paskirtis |
| --- | --- |
| `index.html`, `styles.css` | Programėlės karkasas ir dizainas |
| `js/app.js` | Vartotojo sąsaja |
| `js/planner.js` | Planavimo, pirkinių sąrašo, kainų ir norų logika (be DOM, testuojama) |
| `js/data.js` | Produktai, apytikslės kainos, receptai, parduotuvės |
| `js/store.js` | Duomenų saugojimas įrenginyje |
| `js/receipt.js`, `js/match.js` | Čekių analizė, produktų atpažinimas |
| `js/nutrition.js` | Apytikslė maistinė vertė |
| `scripts/fetch-prices.mjs` | Kainų ir akcijų rinkimas |
| `scripts/fetch-images.mjs` | Receptų nuotraukos (TheMealDB, Wikimedia Commons) |
| `scripts/import-mealdb.mjs`, `build-mealdb.mjs` | TheMealDB receptų importas ir vertimų sujungimas |
| `data/prices.json` | Surinktos kainos |
| `sw.js`, `manifest.webmanifest` | Veikimas be interneto ir įdiegimas |

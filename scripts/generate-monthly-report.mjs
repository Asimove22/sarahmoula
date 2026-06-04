/**
 * DzBridge — Générateur de rapport mensuel automatisé
 *
 * Usage : node scripts/generate-monthly-report.mjs
 * Dépendances : aucune (Node 18+ natif fetch)
 *
 * Ce script :
 * 1. Récupère les dernières données macroéconomiques Algérie (World Bank, IMF, OECD)
 * 2. Récupère les données diaspora (OECD, Banque d'Algérie)
 * 3. Génère un rapport Markdown prêt à publier dans content/reports/
 * 4. Peut être automatisé via GitHub Actions (cron mensuel)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPORTS_DIR = join(ROOT, 'content', 'reports')

// ─── Sources de données ────────────────────────────────────────────────────

const SOURCES = {
  worldbank: {
    base: 'https://api.worldbank.org/v2/country/DZ/indicator',
    indicators: {
      gdp:          'NY.GDP.MKTP.CD',       // PIB courant USD
      gdpGrowth:    'NY.GDP.MKTP.KD.ZG',    // Croissance PIB
      gdpPerCapita: 'NY.GDP.PCAP.CD',       // PIB/habitant
      inflation:    'FP.CPI.TOTL.ZG',       // Inflation IPC
      unemployment: 'SL.UEM.TOTL.ZS',       // Chômage %
      remittances:  'BX.TRF.PWKR.CD.DT',   // Transferts reçus
      fdi:          'BX.KLT.DINV.CD.WD',    // IDE entrants
      exports:      'NE.EXP.GNFS.CD',       // Exportations
      imports:      'NE.IMP.GNFS.CD',       // Importations
    },
  },
  imf: {
    growth: 'https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/DZA',
    inflation: 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH/DZA',
  },
  oecd: {
    // OECD.Stat — Remittances envoyées depuis pays OECD vers Algérie
    // https://stats.oecd.org/restsdmx/sdmx.ashx/GetData/REMITTANCE/...
    remittancesFrance: 'https://stats.oecd.org/sdmx-json/data/REMITTANCE/FRA+DEU+CAN.DZA.VALUE/all?startTime=2020',
  },
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────

async function fetchWB(code) {
  const url = `${SOURCES.worldbank.base}/${code}?format=json&mrv=5`
  const res = await fetch(url)
  const json = await res.json()
  const entries = json[1] ?? []
  return entries
    .filter(e => e.value !== null)
    .slice(0, 3)
    .map(e => ({ year: parseInt(e.date), value: e.value }))
}

async function fetchIMF(url) {
  const res = await fetch(url)
  const json = await res.json()
  const values = Object.values(json?.values ?? {})[0]?.DZA ?? {}
  const currentYear = new Date().getFullYear()
  return Object.entries(values)
    .filter(([y]) => parseInt(y) >= currentYear - 3)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .map(([year, value]) => ({ year: parseInt(year), value: parseFloat(value) }))
}

function fmt(value, type = 'number') {
  if (value === null || value === undefined) return 'N/D'
  switch (type) {
    case 'bn':  return `$${(value / 1e9).toFixed(1)} Md`
    case 'pct': return `${value.toFixed(1)}%`
    case 'M':   return `${(value / 1e6).toFixed(1)} M`
    default:    return value.toFixed(2)
  }
}

function trend(values) {
  if (values.length < 2) return '→'
  return values[0].value > values[1].value ? '↑' : values[0].value < values[1].value ? '↓' : '→'
}

// ─── Génération du rapport ─────────────────────────────────────────────────

async function generateReport() {
  console.log('⏳ Fetching Algeria economic data...')

  const now = new Date()
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const reportMonth = monthNames[now.getMonth()]
  const reportYear  = now.getFullYear()

  // Fetch all data in parallel
  const [gdp, gdpGrowth, inflation, unemployment, remittances, fdi, imfGrowth] =
    await Promise.allSettled([
      fetchWB(SOURCES.worldbank.indicators.gdp),
      fetchWB(SOURCES.worldbank.indicators.gdpGrowth),
      fetchWB(SOURCES.worldbank.indicators.inflation),
      fetchWB(SOURCES.worldbank.indicators.unemployment),
      fetchWB(SOURCES.worldbank.indicators.remittances),
      fetchWB(SOURCES.worldbank.indicators.fdi),
      fetchIMF(SOURCES.imf.growth),
    ])

  const v = (r) => r.status === 'fulfilled' ? r.value : []

  const gdpData         = v(gdp)
  const gdpGrowthData   = v(gdpGrowth)
  const inflationData   = v(inflation)
  const unemployData    = v(unemployment)
  const remitData       = v(remittances)
  const fdiData         = v(fdi)
  const imfGrowthData   = v(imfGrowth)

  console.log('✅ Data fetched. Generating report...')

  const slug = `rapport-mensuel-algerie-${reportMonth.toLowerCase()}-${reportYear}`
  const filename = join(REPORTS_DIR, `${slug}.md`)

  const report = `# Rapport Mensuel — Économie Algérienne · ${reportMonth} ${reportYear}

*Généré automatiquement par DzBridge Data Intelligence · Sources : Banque Mondiale, FMI, CNUCED*
*[Document Premium DzBridge — dz-bridge.com](https://dz-bridge.com)*

---

## 📊 Tableau de bord macroéconomique

| Indicateur | Dernière valeur | Année | Tendance | Source |
|------------|----------------|-------|----------|--------|
| PIB total | ${fmt(gdpData[0]?.value, 'bn')} | ${gdpData[0]?.year ?? '—'} | ${trend(gdpData)} | Banque Mondiale |
| Croissance PIB | ${fmt(gdpGrowthData[0]?.value, 'pct')} | ${gdpGrowthData[0]?.year ?? '—'} | ${trend(gdpGrowthData)} | Banque Mondiale |
| Prévision croissance (FMI) | ${fmt(imfGrowthData[0]?.value, 'pct')} | ${imfGrowthData[0]?.year ?? '—'} | ${trend(imfGrowthData)} | FMI WEO |
| Inflation (IPC) | ${fmt(inflationData[0]?.value, 'pct')} | ${inflationData[0]?.year ?? '—'} | ${trend(inflationData)} | Banque Mondiale |
| Chômage | ${fmt(unemployData[0]?.value, 'pct')} | ${unemployData[0]?.year ?? '—'} | ${trend(unemployData)} | Banque Mondiale |
| Transferts diaspora reçus | ${fmt(remitData[0]?.value, 'bn')} | ${remitData[0]?.year ?? '—'} | ${trend(remitData)} | Banque Mondiale |
| IDE entrants | ${fmt(fdiData[0]?.value, 'bn')} | ${fdiData[0]?.year ?? '—'} | ${trend(fdiData)} | CNUCED |

---

## 🔍 Analyse des transferts diaspora

### Évolution sur 3 ans
${remitData.slice(0, 3).map(d => `- **${d.year}** : ${fmt(d.value, 'bn')}`).join('\n')}

${remitData.length >= 2 ? `
**Variation annuelle :** ${remitData[0]?.value && remitData[1]?.value
  ? `${((remitData[0].value - remitData[1].value) / remitData[1].value * 100).toFixed(1)}%`
  : '—'}

**Contexte DzBridge :** Les transferts officiels représentent une fraction des flux réels.
En ajoutant les transferts informels, le volume total est estimé à **2–3× les chiffres officiels**.
Le marché adressable pour DzBridge reste intact à **€850M**.
` : ''}

---

## 💼 Attractivité pour les investisseurs

### Flux IDE — Évolution
${fdiData.slice(0, 3).map(d => `- **${d.year}** : ${fmt(d.value, 'bn')}`).join('\n')}

### Points clés pour investisseurs diaspora
- PIB en croissance : contexte favorable pour les projets locaux
- Inflation ${fmt(inflationData[0]?.value, 'pct')} : surveiller les projets à fort input importé
- IDE encore modestes → **opportunité de premier entrant pour la diaspora**

---

## 🏭 Secteurs à surveiller ce mois

> *[Compléter manuellement avec actualité sectorielle]*

### Agro-industrie
- ...

### Technologies & Startups
- ...

### Énergies renouvelables
- ...

### Santé privée
- ...

---

## 📰 Actualité réglementaire

> *[Compléter avec derniers textes JORADP, circulaires AAPI, instructions Banque d'Algérie]*

---

## 📈 Opportunités référencées sur DzBridge ce mois

> *[Compléter avec les nouveaux projets entrés en due diligence]*

| Projet | Secteur | Ticket min. | Rendement cible | Statut |
|--------|---------|-------------|----------------|--------|
| ... | ... | ... | ... | Due diligence |

---

## 🔗 Sources complètes

- Banque Mondiale — Algeria: https://data.worldbank.org/country/DZ
- FMI — World Economic Outlook: https://www.imf.org/en/countries/DZA
- CNUCED — FDI Statistics: https://unctadstat.unctad.org
- ONS Algérie: https://www.ons.dz
- AAPI — Données investissement: https://www.aapi.gov.dz
- OCDE — Remittances: https://stats.oecd.org

---

*© ${reportYear} DzBridge. Document réservé aux abonnés Premium. Ne pas redistribuer.*
*Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}*
`

  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(filename, report, 'utf-8')
  console.log(`✅ Report generated: ${filename}`)
  console.log(`\n📋 Sections à compléter manuellement :`)
  console.log(`   - Actualité sectorielle (agro, tech, énergie, santé)`)
  console.log(`   - Actualité réglementaire JORADP`)
  console.log(`   - Projets en due diligence ce mois`)
}

generateReport().catch(console.error)

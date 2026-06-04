// World Bank API — Algeria indicators (no API key needed)
const WB_BASE = 'https://api.worldbank.org/v2/country/DZ/indicator'

export interface Indicator {
  value: number | null
  year: number
  label: string
  unit: string
  source: string
  sourceUrl: string
}

async function fetchWB(indicatorCode: string): Promise<{ value: number | null; year: number }> {
  const res = await fetch(`${WB_BASE}/${indicatorCode}?format=json&mrv=3`)
  if (!res.ok) throw new Error('WB fetch failed')
  const json = await res.json()
  const entries: Array<{ value: number | null; date: string }> = json[1] ?? []
  const latest = entries.find((e) => e.value !== null)
  return {
    value: latest?.value ?? null,
    year: latest ? parseInt(latest.date) : new Date().getFullYear() - 1,
  }
}

async function fetchIMFGrowth(): Promise<{ value: number | null; year: number }> {
  const res = await fetch('https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/DZA')
  if (!res.ok) throw new Error('IMF fetch failed')
  const json = await res.json()
  const values = json?.values?.NGDP_RPCH?.DZA ?? {}
  const years = Object.keys(values).sort((a, b) => parseInt(b) - parseInt(a))
  const latest = years[0]
  return { value: latest ? values[latest] : null, year: latest ? parseInt(latest) : 2024 }
}

export async function fetchAlgeriaIndicators(): Promise<Indicator[]> {
  const [gdp, growth, population, remittances, inflation, fdi] = await Promise.allSettled([
    fetchWB('NY.GDP.MKTP.CD'),      // PIB courant USD
    fetchIMFGrowth(),                // Croissance PIB %
    fetchWB('SP.POP.TOTL'),         // Population
    fetchWB('BX.TRF.PWKR.CD.DT'),  // Transferts diaspora reçus
    fetchWB('FP.CPI.TOTL.ZG'),     // Inflation
    fetchWB('BX.KLT.DINV.CD.WD'),  // IDE entrants
  ])

  const v = (r: PromiseSettledResult<{ value: number | null; year: number }>) =>
    r.status === 'fulfilled' ? r.value : { value: null, year: 0 }

  return [
    {
      ...v(gdp),
      label: 'PIB Algérie',
      unit: 'Mds USD',
      source: 'Banque Mondiale',
      sourceUrl: 'https://data.worldbank.org/country/DZ',
    },
    {
      ...v(growth),
      label: 'Croissance PIB',
      unit: '%',
      source: 'FMI',
      sourceUrl: 'https://www.imf.org/en/countries/DZA',
    },
    {
      ...v(population),
      label: 'Population',
      unit: 'M hab.',
      source: 'Banque Mondiale',
      sourceUrl: 'https://data.worldbank.org/country/DZ',
    },
    {
      ...v(remittances),
      label: 'Transferts diaspora',
      unit: 'Mds USD',
      source: 'Banque Mondiale',
      sourceUrl: 'https://data.worldbank.org/indicator/BX.TRF.PWKR.CD.DT',
    },
    {
      ...v(inflation),
      label: 'Inflation',
      unit: '%',
      source: 'Banque Mondiale',
      sourceUrl: 'https://data.worldbank.org/country/DZ',
    },
    {
      ...v(fdi),
      label: 'IDE entrants',
      unit: 'Mds USD',
      source: 'Banque Mondiale / CNUCED',
      sourceUrl: 'https://unctadstat.unctad.org',
    },
  ]
}

export function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—'
  if (unit === 'Mds USD') return `$${(value / 1e9).toFixed(1)}Md`
  if (unit === 'M hab.') return `${(value / 1e6).toFixed(1)}M`
  if (unit === '%') return `${value.toFixed(1)}%`
  return String(value)
}

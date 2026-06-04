import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, RefreshCw, ExternalLink } from 'lucide-react'
import { fetchAlgeriaIndicators, formatValue, type Indicator } from '../services/worldbank'
import { useLang } from '../context/LangContext'

const FALLBACK: Indicator[] = [
  { value: 239e9,  year: 2023, label: 'PIB Algérie',        unit: 'Mds USD',  source: 'Banque Mondiale', sourceUrl: 'https://data.worldbank.org/country/DZ' },
  { value: 3.8,    year: 2024, label: 'Croissance PIB',     unit: '%',        source: 'FMI',             sourceUrl: 'https://www.imf.org/en/countries/DZA' },
  { value: 45.6e6, year: 2023, label: 'Population',         unit: 'M hab.',   source: 'Banque Mondiale', sourceUrl: 'https://data.worldbank.org/country/DZ' },
  { value: 2.6e9,  year: 2022, label: 'Transferts diaspora',unit: 'Mds USD',  source: 'Banque Mondiale', sourceUrl: 'https://data.worldbank.org/indicator/BX.TRF.PWKR.CD.DT' },
  { value: 9.3,    year: 2023, label: 'Inflation',          unit: '%',        source: 'Banque Mondiale', sourceUrl: 'https://data.worldbank.org/country/DZ' },
  { value: 1.1e9,  year: 2022, label: 'IDE entrants',       unit: 'Mds USD',  source: 'CNUCED',          sourceUrl: 'https://unctadstat.unctad.org' },
]

const LABELS_IT: Record<string, string> = {
  'PIB Algérie': 'PIL Algeria',
  'Croissance PIB': 'Crescita PIL',
  'Population': 'Popolazione',
  'Transferts diaspora': 'Trasferimenti diaspora',
  'Inflation': 'Inflazione',
  'IDE entrants': 'IDE in entrata',
}

export default function Indicators() {
  const [data, setData] = useState<Indicator[]>(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const { lang } = useLang()

  useEffect(() => {
    fetchAlgeriaIndicators()
      .then((res) => {
        const merged = res.map((r, i) => (r.value !== null ? r : FALLBACK[i]))
        setData(merged)
        setLive(true)
      })
      .catch(() => setLive(false))
      .finally(() => setLoading(false))
  }, [])

  const label = (fr: string) => lang === 'it' ? (LABELS_IT[fr] ?? fr) : fr

  const sectionLabel = lang === 'it' ? 'Indicatori macroeconomici Algeria' : 'Indicateurs macroéconomiques Algérie'
  const liveLabel    = lang === 'it' ? 'Dati in tempo reale' : 'Données en temps réel'
  const fallbackLabel = lang === 'it' ? 'Dati ufficiali' : 'Données officielles'
  const sourcedLabel  = lang === 'it' ? 'Fonte' : 'Source'

  return (
    <section className="py-20 bg-navy-mid/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-dz/0 via-navy-mid/30 to-navy-dz/0 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-dz/20 flex items-center justify-center">
              <TrendingUp className="text-green-dz" size={20} />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{sectionLabel}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {loading ? (
                  <RefreshCw size={12} className="text-slate-500 animate-spin" />
                ) : (
                  <span className={`w-2 h-2 rounded-full ${live ? 'bg-green-dz animate-pulse' : 'bg-gold-dz'}`} />
                )}
                <span className="text-slate-500 text-xs">
                  {loading ? '...' : live ? liveLabel : fallbackLabel}
                </span>
              </div>
            </div>
          </div>
          <a
            href="https://data.worldbank.org/country/DZ"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            <ExternalLink size={12} />
            World Bank · IMF · CNUCED
          </a>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.map((ind, i) => (
            <motion.a
              key={i}
              href={ind.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group p-4 rounded-2xl bg-white/4 border border-white/8 hover:border-green-dz/30 hover:bg-white/6 transition-all duration-200 cursor-pointer"
            >
              <div className="text-2xl font-black text-white mb-1 group-hover:text-green-dz transition-colors">
                {loading ? (
                  <span className="inline-block w-16 h-7 bg-white/10 rounded animate-pulse" />
                ) : (
                  formatValue(ind.value, ind.unit)
                )}
              </div>
              <div className="text-slate-300 text-xs font-medium mb-2">{label(ind.label)}</div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-[10px]">{ind.year}</span>
                <span className="text-slate-600 text-[10px] group-hover:text-slate-400 transition-colors">
                  {sourcedLabel}: {ind.source}
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}

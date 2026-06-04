import { motion } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'

const phases = [
  {
    phase: '01',
    period: 'T1–T2 2026',
    title: 'Validation',
    status: 'En cours',
    statusColor: 'text-green-dz border-green-dz/40 bg-green-dz/10',
    steps: [
      { done: true, text: 'Prototype v1 développé' },
      { done: true, text: '50 bêta-testeurs' },
      { done: true, text: '3 projets pilotes' },
      { done: true, text: 'Partenariat ANDI' },
      { done: false, text: 'Dépôt de marque' },
    ],
  },
  {
    phase: '02',
    period: 'T3–T4 2026',
    title: 'Lancement',
    status: 'Prochain',
    statusColor: 'text-gold-dz border-gold-dz/40 bg-gold-dz/10',
    steps: [
      { done: false, text: 'Ouverture publique' },
      { done: false, text: '500 membres actifs' },
      { done: false, text: '20 projets live' },
      { done: false, text: 'Levée seed €500K' },
      { done: false, text: 'Événements Paris & Alger' },
    ],
  },
  {
    phase: '03',
    period: '2027',
    title: 'Croissance',
    status: 'Futur',
    statusColor: 'text-slate-400 border-slate-600/40 bg-slate-800/40',
    steps: [
      { done: false, text: '5 000 membres actifs' },
      { done: false, text: '€5M investis via plateforme' },
      { done: false, text: 'Expansion Canada & UK' },
      { done: false, text: 'Application mobile' },
      { done: false, text: 'Break-even atteint' },
    ],
  },
]

export default function Roadmap() {
  return (
    <section className="py-28 bg-navy-dz relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-green-dz/5 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-green-dz/40 text-green-dz text-sm font-medium mb-4">
            Feuille de route
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Roadmap <span className="text-green-dz">2026–2027</span>
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Une stratégie en 3 phases : validation, lancement public, puis passage à l'échelle international.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-dz/30 to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {phases.map((ph, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {/* Phase number bubble */}
                <div className="lg:absolute lg:-top-6 lg:left-1/2 lg:-translate-x-1/2 lg:z-10 flex lg:justify-center mb-4 lg:mb-0">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-lg ${
                    i === 0 ? 'border-green-dz bg-green-dz text-white' :
                    i === 1 ? 'border-gold-dz bg-gold-dz text-navy-dz' :
                    'border-slate-600 bg-navy-dz text-slate-400'
                  }`}>
                    {ph.phase}
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${
                  i === 0 ? 'border-green-dz/30 bg-green-dz/5' :
                  i === 1 ? 'border-gold-dz/30 bg-gold-dz/5' :
                  'border-white/10 bg-white/3'
                } lg:mt-8`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-slate-400 text-xs font-medium mb-1">{ph.period}</p>
                      <h3 className="text-white font-bold text-xl">{ph.title}</h3>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ph.statusColor}`}>
                      {ph.status}
                    </span>
                  </div>

                  <ul className="space-y-2.5">
                    {ph.steps.map((s, j) => (
                      <li key={j} className="flex items-center gap-2.5">
                        {s.done ? (
                          <CheckCircle2 size={16} className="text-green-dz shrink-0" />
                        ) : (
                          <Circle size={16} className="text-slate-600 shrink-0" />
                        )}
                        <span className={`text-sm ${s.done ? 'text-slate-300' : 'text-slate-500'}`}>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Funnel */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-slate-500 text-sm mb-4 uppercase tracking-widest">Funnel stratégique</p>
          <div className="flex flex-wrap justify-center items-center gap-2">
            {['Contenu', 'Leads', 'Communauté', 'Matching', 'Deals', 'Revenus'].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium">
                  {step}
                </span>
                {i < arr.length - 1 && <span className="text-gold-dz text-lg">→</span>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

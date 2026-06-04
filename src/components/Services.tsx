import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { CheckCircle2, TrendingUp, Scale, Users2, BarChart3 } from 'lucide-react'

const problems = [
  'Opacité juridique — réglementation des changes complexe',
  'Manque de confiance — absence de partenaires locaux vérifiés',
  'Distance & suivi — impossible de gérer un projet à 3 000 km',
  'Transferts bloqués — rapatriement des dividendes difficile',
]

const solutions = [
  { icon: Scale, title: 'Conformité intégrée', desc: 'KYC/AML, loi n°22-18, RGPD, DSP2 — 100% conforme cadre algérien et européen.' },
  { icon: CheckCircle2, title: 'Partenaires vérifiés', desc: 'Due diligence rigoureuse sur chaque projet et chaque partenaire local.' },
  { icon: TrendingUp, title: 'Suivi temps réel', desc: 'Tableau de bord transparent pour suivre ses investissements depuis n\'importe où.' },
  { icon: Users2, title: 'Co-investissement', desc: 'Ticket d\'entrée abaissé, risques mutualisés, pool d\'investisseurs communautaire.' },
  { icon: BarChart3, title: 'Rapports sectoriels', desc: 'Analyses et guides sectoriels fournis avec l\'abonnement Premium à €49/mois.' },
]

export default function Services() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section id="services" className="py-28 bg-navy-dz relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-green-dz/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-green-dz/40 text-green-dz text-sm font-medium mb-4">
            Services
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Ce que DzBridge{' '}
            <span className="text-green-dz">résout concrètement</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Problèmes */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-xs">✕</span>
              Les obstacles de la diaspora
            </h3>
            <div className="space-y-4">
              {problems.map((pb, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/10"
                >
                  <span className="mt-0.5 text-red-400 text-lg leading-none">✕</span>
                  <p className="text-slate-300 text-sm leading-relaxed">{pb}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-dz/20 border border-green-dz/40 flex items-center justify-center text-green-dz text-xs">✓</span>
              Les réponses DzBridge
            </h3>
            <div className="space-y-3">
              {solutions.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-green-dz/5 border border-green-dz/20 hover:border-green-dz/40 transition-colors"
                >
                  <s.icon className="text-green-dz mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-white font-semibold text-sm">{s.title}</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Modèle économique */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-20"
        >
          <h3 className="text-center text-2xl font-bold text-white mb-8">Modèle économique transparent</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Commission transactions', detail: '1–3% par investissement', pct: '45%', color: 'green' },
              { label: 'Abonnement Premium', detail: '€49/mois — accès complet', pct: '30%', color: 'gold' },
              { label: 'Services B2B', detail: 'Entreprises algériennes', pct: '15%', color: 'green' },
              { label: 'Partenariats institutionnels', detail: 'Ambassades, banques', pct: '10%', color: 'gold' },
            ].map((m, i) => (
              <div key={i} className={`p-5 rounded-2xl border ${m.color === 'green' ? 'border-green-dz/30 bg-green-dz/5' : 'border-gold-dz/30 bg-gold-dz/5'} text-center`}>
                <div className={`text-3xl font-black mb-1 ${m.color === 'green' ? 'text-green-dz' : 'text-gold-dz'}`}>{m.pct}</div>
                <div className="text-white font-semibold text-sm mb-1">{m.label}</div>
                <div className="text-slate-400 text-xs">{m.detail}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-6">
            Objectif Année 3 (2028) : <span className="text-white font-semibold">€2,4M ARR</span> · Break-even <span className="text-white font-semibold">Mois 18 (2027)</span> · Marge brute cible <span className="text-white font-semibold">72%</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

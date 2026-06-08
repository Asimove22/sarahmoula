import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { ShoppingBag, Users, Lightbulb, Globe2 } from 'lucide-react'

const piliers = [
  {
    icon: ShoppingBag,
    title: 'Marketplace d\'Investissement',
    desc: 'Projets vérifiés, due diligence intégrée, co-investissement en pool et suivi en temps réel. Ticket d\'entrée accessible, risques mutualisés.',
    sectors: ['Agro-industrie', 'Tech', 'Tourisme', 'Santé', 'Énergie', 'BTP'],
  },
  {
    icon: Users,
    title: 'Matching de Compétences',
    desc: 'Mise en relation entre experts diaspora — médecins, ingénieurs, juristes, financiers — et entreprises algériennes. Transfert de savoir-faire concret.',
    sectors: ['Médecine', 'Ingénierie', 'Finance', 'Droit'],
  },
  {
    icon: Lightbulb,
    title: 'Incubateur Diaspora',
    desc: 'Accompagnement complet : assistance juridique, réseau de partenaires locaux vérifiés, études de marché sectorielles et mentorat personnalisé.',
    sectors: ['Juridique', 'Réseau terrain', 'Mentorat', 'Études'],
  },
  {
    icon: Globe2,
    title: 'Communauté & Réseau',
    desc: 'Espace communautaire par pays et secteur. Événements à Alger, Paris, Montréal. Programme d\'ambassadeurs diaspora international.',
    sectors: ['France', 'Canada', 'Allemagne', 'UK', 'Émirats'],
  },
]

function PilierCard({ p, i }: { p: typeof piliers[0]; i: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: i * 0.12 }}
      className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-green-dz/50 hover:bg-white/8 transition-all duration-300"
    >
      <div className="w-12 h-12 rounded-xl bg-green-dz/20 flex items-center justify-center mb-4 group-hover:bg-green-dz/30 transition-colors">
        <p.icon className="text-green-dz" size={22} />
      </div>
      <h3 className="text-white font-bold text-lg mb-3">{p.title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-4">{p.desc}</p>
      <div className="flex flex-wrap gap-2">
        {p.sectors.map((s) => (
          <span key={s} className="px-2 py-1 rounded-full bg-gold-dz/10 border border-gold-dz/20 text-gold-dz text-xs font-medium">
            {s}
          </span>
        ))}
      </div>
      <div className="absolute top-4 right-4 text-4xl font-black text-white/5 select-none">0{i + 1}</div>
    </motion.div>
  )
}

export default function Apropos() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section id="apropos" className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-dz via-navy-mid/50 to-navy-dz pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-green-dz/40 text-green-dz text-sm font-medium mb-4">
            À propos
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Un catalyseur pour le{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
              co-développement
            </span>
          </h2>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed">
            DzBridge mobilise les capitaux, les compétences et l'énergie entrepreneuriale
            de la diaspora algérienne au service du développement économique de l'Algérie.
            Forte de <strong className="text-white">4,2 millions d'Algériens à l'étranger</strong> et{' '}
            <strong className="text-white">2,1 milliards d'euros de transferts annuels</strong>,
            cette diaspora est un levier sous-exploité que DzBridge entend transformer.
          </p>
        </motion.div>

        {/* 4 piliers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {piliers.map((p, i) => (
            <PilierCard key={i} p={p} i={i} />
          ))}
        </div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center p-8 rounded-2xl border border-gold-dz/20 bg-gold-dz/5"
        >
          <p className="text-xl md:text-2xl font-display text-white italic mb-3">
            "DzBridge n'est pas un SaaS classique. C'est une communauté qui devient une plateforme business."
          </p>
          <span className="text-gold-dz text-sm font-medium">— Stratégie Go-To-Market DzBridge 2026</span>
        </motion.div>
      </div>
    </section>
  )
}

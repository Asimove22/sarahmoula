import { motion } from 'framer-motion'
import { Wheat, Cpu, Plane, Heart, Sun, Building2 } from 'lucide-react'

const sectors = [
  {
    icon: Wheat,
    title: 'Agro-industrie',
    desc: 'Transformation agroalimentaire, agriculture moderne, exportation de produits locaux vers la diaspora et les marchés européens.',
    potential: 'Fort potentiel',
    color: 'from-amber-900/30 to-amber-800/10',
    border: 'border-amber-700/30',
    iconColor: 'text-amber-400',
  },
  {
    icon: Cpu,
    title: 'Technologies',
    desc: 'Startups tech, fintech, EdTech, plateformes numériques. L\'écosystème Startup Algeria en pleine expansion.',
    potential: 'En forte croissance',
    color: 'from-blue-900/30 to-blue-800/10',
    border: 'border-blue-700/30',
    iconColor: 'text-blue-400',
  },
  {
    icon: Plane,
    title: 'Tourisme',
    desc: 'Hôtellerie, ecotourisme saharien, Casbah d\'Alger, Tassili n\'Ajjer. Un secteur à fort potentiel encore sous-exploité.',
    potential: 'Marché émergent',
    color: 'from-teal-900/30 to-teal-800/10',
    border: 'border-teal-700/30',
    iconColor: 'text-teal-400',
  },
  {
    icon: Heart,
    title: 'Santé',
    desc: 'Cliniques privées, télémédecine, équipements médicaux, pharmaceutique. Demande croissante pour des soins de qualité.',
    potential: 'Priorité nationale',
    color: 'from-rose-900/30 to-rose-800/10',
    border: 'border-rose-700/30',
    iconColor: 'text-rose-400',
  },
  {
    icon: Sun,
    title: 'Énergies renouvelables',
    desc: 'Solaire, éolien, hydrogène vert. L\'Algérie dispose du plus grand potentiel solaire du bassin méditerranéen.',
    potential: 'Stratégique',
    color: 'from-yellow-900/30 to-yellow-800/10',
    border: 'border-yellow-700/30',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Building2,
    title: 'BTP & Immobilier',
    desc: 'Construction résidentielle et commerciale, immobilier locatif, infrastructures. Un secteur en demande constante.',
    potential: 'Stable & rentable',
    color: 'from-orange-900/30 to-orange-800/10',
    border: 'border-orange-700/30',
    iconColor: 'text-orange-400',
  },
]

const projections = [
  { label: 'Membres actifs — An 1', value: '500' },
  { label: 'Membres actifs — An 2', value: '3 000' },
  { label: 'Membres actifs — An 3', value: '12 000' },
  { label: 'Volume investi — An 3', value: '€12M' },
  { label: 'Projets financés — An 3', value: '300' },
  { label: 'Revenu annuel — An 3', value: '€2,4M' },
]

export default function Portfolio() {
  return (
    <section id="portfolio" className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-dz to-navy-mid pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-gold-dz/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-gold-dz/40 text-gold-dz text-sm font-medium mb-4">
            Opportunités
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Secteurs prioritaires{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
              d'investissement
            </span>
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Marché adressable estimé à <strong className="text-white">€850M</strong>. DzBridge cible 6 secteurs porteurs pour la diaspora.
          </p>
        </motion.div>

        {/* Sectors grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {sectors.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className={`group p-6 rounded-2xl bg-gradient-to-br ${s.color} border ${s.border} transition-all duration-300`}
            >
              <div className="flex items-start justify-between mb-4">
                <s.icon className={s.iconColor} size={28} />
                <span className={`text-xs font-medium px-2 py-1 rounded-full bg-white/5 ${s.iconColor}`}>
                  {s.potential}
                </span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Projections */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-gold-dz/20 bg-gold-dz/5 p-8"
        >
          <h3 className="text-center text-2xl font-bold text-white mb-8">Projections de croissance</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {projections.map((p, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-black text-gold-dz mb-1">{p.value}</div>
                <div className="text-slate-400 text-xs leading-tight">{p.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

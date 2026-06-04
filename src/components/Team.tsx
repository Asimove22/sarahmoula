import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { useLang } from '../context/LangContext'

const memberColors = ['bg-green-dz', 'bg-gold-dz', 'bg-navy-light', 'bg-green-dark']

export default function Team() {
  const { t } = useLang()
  const { team: tm } = t

  return (
    <section className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-navy-mid to-navy-dz pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-gold-dz/40 text-gold-dz text-sm font-medium mb-4">
            {tm.badge}
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {tm.headline1}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
              {tm.headline2}
            </span>
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">{tm.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tm.members.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 text-center"
            >
              <div className={`w-16 h-16 rounded-2xl ${memberColors[i]} flex items-center justify-center text-white font-black text-lg mx-auto mb-4`}>
                {m.initials}
              </div>
              <h3 className="text-white font-bold text-base mb-1">{m.role}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{m.bio}</p>
              <button className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-gold-dz text-xs">
                <ExternalLink size={14} />
                LinkedIn
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-slate-500 text-sm uppercase tracking-widest mb-4">{tm.advisors_label}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {tm.advisors.map((a, i) => (
              <span key={i} className="px-4 py-2 rounded-full border border-white/10 text-slate-300 text-sm">
                {a}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

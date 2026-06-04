import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ShoppingBag, Users, Lightbulb, Globe2 } from 'lucide-react'
import { useLang } from '../context/LangContext'

const icons = [ShoppingBag, Users, Lightbulb, Globe2]

function PilierCard({ p, i }: { p: { title: string; desc: string; sectors: readonly string[] }; i: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const Icon = icons[i]
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: i * 0.12 }}
      className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-green-dz/50 hover:bg-white/8 transition-all duration-300"
    >
      <div className="w-12 h-12 rounded-xl bg-green-dz/20 flex items-center justify-center mb-4 group-hover:bg-green-dz/30 transition-colors">
        <Icon className="text-green-dz" size={22} />
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
  const { t } = useLang()
  const { apropos: a } = t

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
            {a.badge}
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {a.headline1}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
              {a.headline2}
            </span>
          </h2>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed">
            {a.subtitle_1}
            <strong className="text-white">{a.subtitle_bold1}</strong>
            {a.subtitle_2}
            <strong className="text-white">{a.subtitle_bold2}</strong>
            {a.subtitle_3}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {a.piliers.map((p, i) => (
            <PilierCard key={i} p={p} i={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center p-8 rounded-2xl border border-gold-dz/20 bg-gold-dz/5"
        >
          <p className="text-xl md:text-2xl font-display text-white italic mb-3">
            "{a.quote}"
          </p>
          <span className="text-gold-dz text-sm font-medium">{a.quote_source}</span>
        </motion.div>
      </div>
    </section>
  )
}

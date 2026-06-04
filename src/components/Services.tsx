import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { CheckCircle2, TrendingUp, Scale, Users2, BarChart3 } from 'lucide-react'
import { useLang } from '../context/LangContext'

const solutionIcons = [Scale, CheckCircle2, TrendingUp, Users2, BarChart3]

export default function Services() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const { t } = useLang()
  const { services: s } = t

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
            {s.badge}
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {s.headline1}{' '}
            <span className="text-green-dz">{s.headline2}</span>
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
              {s.problems_title}
            </h3>
            <div className="space-y-4">
              {s.problems.map((pb, i) => (
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
              {s.solutions_title}
            </h3>
            <div className="space-y-3">
              {s.solutions.map((sol, i) => {
                const Icon = solutionIcons[i]
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-4 rounded-xl bg-green-dz/5 border border-green-dz/20 hover:border-green-dz/40 transition-colors"
                  >
                    <Icon className="text-green-dz mt-0.5 shrink-0" size={18} />
                    <div>
                      <p className="text-white font-semibold text-sm">{sol.title}</p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{sol.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
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
          <h3 className="text-center text-2xl font-bold text-white mb-8">{s.model_title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {s.model_items.map((m, i) => (
              <div key={i} className={`p-5 rounded-2xl border ${m.color === 'green' ? 'border-green-dz/30 bg-green-dz/5' : 'border-gold-dz/30 bg-gold-dz/5'} text-center`}>
                <div className={`text-3xl font-black mb-1 ${m.color === 'green' ? 'text-green-dz' : 'text-gold-dz'}`}>{m.pct}</div>
                <div className="text-white font-semibold text-sm mb-1">{m.label}</div>
                <div className="text-slate-400 text-xs">{m.detail}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-6">
            {s.model_footer.split(s.model_footer_arr)[0]}
            <span className="text-white font-semibold">{s.model_footer_arr}</span>
            {s.model_footer.split(s.model_footer_arr)[1].split(s.model_footer_be)[0]}
            <span className="text-white font-semibold">{s.model_footer_be}</span>
            {s.model_footer.split(s.model_footer_be)[1].split(s.model_footer_mg)[0]}
            <span className="text-white font-semibold">{s.model_footer_mg}</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

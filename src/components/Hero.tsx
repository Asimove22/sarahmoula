import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Logo from './Logo'
import { useLang } from '../context/LangContext'

export default function Hero() {
  const { t } = useLang()
  const { hero } = t

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-dz via-navy-mid to-[#0a2218]" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#006233 1px, transparent 1px), linear-gradient(90deg, #006233 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-green-dz/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-gold-dz/6 blur-3xl pointer-events-none" />

      {/* Animated rings */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-green-dz/8"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-gold-dz/6"
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20 text-center">

        {/* Logo large */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="flex justify-center mb-6"
        >
          <Logo size={80} />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-dz/40 bg-gold-dz/10 text-gold-dz text-sm font-medium mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-gold-dz animate-pulse" />
          {hero.badge}
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6"
        >
          {hero.headline1}{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
            {hero.headline2}
          </span>
          <br />
          {hero.headline3} <span className="text-green-dz">{hero.headline4}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-4 leading-relaxed"
        >
          {hero.subtitle}
        </motion.p>

        {/* Country tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {hero.countries.map((c) => (
            <span key={c} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs">
              {c}
            </span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
        >
          <a
            href="#contact"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gold-dz text-navy-dz font-bold text-base hover:bg-gold-light transition-all duration-200 shadow-lg shadow-gold-dz/20"
          >
            {hero.cta_primary}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#apropos"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-semibold text-base hover:border-green-dz/50 hover:bg-green-dz/5 transition-all duration-200"
          >
            {hero.cta_secondary}
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
        >
          {hero.stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.08 }}
              className="flex flex-col items-center gap-1 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <span className="text-3xl font-black text-white">{s.value}</span>
              <span className="text-slate-400 text-xs text-center">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-px h-10 bg-gradient-to-b from-gold-dz/50 to-transparent" />
      </motion.div>
    </section>
  )
}

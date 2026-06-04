import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { useLang } from '../context/LangContext'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { lang, setLang, t } = useLang()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: t.nav.apropos, href: '#apropos' },
    { label: t.nav.services, href: '#services' },
    { label: t.nav.opportunites, href: '#portfolio' },
    { label: t.nav.contact, href: '#contact' },
  ]

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-navy-dz/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <Logo size={38} />
          <span className="text-white font-bold text-xl tracking-tight hidden sm:block">
            Dz<span className="text-gold-dz">Bridge</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-slate-300 hover:text-gold-dz transition-colors duration-200 text-sm font-medium"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right side: lang toggle + CTA */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setLang('fr')}
              className={`px-3 py-1.5 transition-colors duration-150 ${
                lang === 'fr'
                  ? 'bg-gold-dz text-navy-dz'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang('it')}
              className={`px-3 py-1.5 transition-colors duration-150 ${
                lang === 'it'
                  ? 'bg-gold-dz text-navy-dz'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              IT
            </button>
          </div>

          <span className="text-slate-500 text-xs border border-green-dz/30 px-2 py-1 rounded-full text-green-dz">
            {t.nav.phase}
          </span>
          <a
            href="#contact"
            className="px-5 py-2 rounded-lg bg-gold-dz text-navy-dz text-sm font-bold hover:bg-gold-light transition-all duration-200"
          >
            {t.nav.cta}
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white p-1"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-navy-dz/98 border-t border-white/10 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-slate-300 hover:text-gold-dz text-base font-medium py-1"
                >
                  {l.label}
                </a>
              ))}

              {/* Mobile lang toggle */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-500 text-xs">Langue :</span>
                <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs font-semibold">
                  <button
                    onClick={() => setLang('fr')}
                    className={`px-3 py-1.5 transition-colors ${lang === 'fr' ? 'bg-gold-dz text-navy-dz' : 'text-slate-400'}`}
                  >
                    FR
                  </button>
                  <button
                    onClick={() => setLang('it')}
                    className={`px-3 py-1.5 transition-colors ${lang === 'it' ? 'bg-gold-dz text-navy-dz' : 'text-slate-400'}`}
                  >
                    IT
                  </button>
                </div>
              </div>

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-2 px-5 py-3 rounded-lg bg-gold-dz text-navy-dz text-sm font-bold text-center"
              >
                {t.nav.cta}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

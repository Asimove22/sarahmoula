import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Phone, Globe, ArrowRight, Send } from 'lucide-react'
import { useLang } from '../context/LangContext'

export default function Contact() {
  const [selected, setSelected] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const { t } = useLang()
  const { contact: c } = t

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  const coords = [
    { icon: Mail, label: 'Email', value: 'dzbridge@dzbridge.fr', href: 'mailto:dzbridge@dzbridge.fr' },
    { icon: Phone, label: 'France', value: '+33 (0) 6 13 67 82 58', href: 'tel:+33613678258' },
    { icon: Phone, label: 'France', value: '+33 (0) 6 16 04 28 80', href: 'tel:+33616042880' },
    { icon: Globe, label: 'Web', value: 'dz-bridge.com', href: 'https://dz-bridge.com' },
    { icon: Globe, label: 'Web', value: 'dzbridge.fr', href: 'https://dzbridge.fr' },
  ]

  return (
    <section id="contact" className="py-28 bg-navy-dz relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-green-dz/5 blur-3xl rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-green-dz/40 text-green-dz text-sm font-medium mb-4">
            {c.badge}
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {c.headline1}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dz to-gold-light">
              {c.headline2}
            </span>
          </h2>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">{c.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-white font-bold text-lg mb-4">{c.profile_title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {c.profiles.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    selected === i
                      ? 'border-gold-dz bg-gold-dz/10 text-white'
                      : 'border-white/10 bg-white/3 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className={`font-semibold text-sm mb-1 ${selected === i ? 'text-gold-dz' : 'text-slate-300'}`}>
                    {p.label}
                  </div>
                  <div className="text-xs">{p.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg mb-2">{c.coords_title}</h3>
              {coords.map((coord, i) => (
                <a key={i} href={coord.href} className="flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-green-dz/40 transition-colors">
                    <coord.icon size={16} className="text-green-dz" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">{coord.label}</p>
                    <p className="text-slate-300 text-sm group-hover:text-white transition-colors">{coord.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-green-dz/30 bg-green-dz/5">
                <div className="w-16 h-16 rounded-full bg-green-dz/20 flex items-center justify-center mb-4">
                  <Send className="text-green-dz" size={28} />
                </div>
                <h3 className="text-white text-2xl font-bold mb-2">{c.success_title}</h3>
                <p className="text-slate-300">{c.success_body}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">{c.form_name}</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={c.form_name_placeholder}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-green-dz/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">{c.form_email}</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-green-dz/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-sm mb-2 block">{c.form_message}</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={c.form_message_placeholder}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-green-dz/50 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gold-dz text-navy-dz font-bold text-base hover:bg-gold-light transition-colors flex items-center justify-center gap-2 group"
                >
                  {c.form_submit}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-slate-500 text-xs text-center">{c.form_seed}</p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="bg-navy-dz border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Logo size={42} />
              <div>
                <span className="text-white font-bold text-xl">DzBridge</span>
                <p className="text-slate-500 text-xs">La passerelle de la diaspora algérienne</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Connecter investisseurs diaspora et porteurs de projets algériens. Investissement · Compétences · Incubation · Communauté.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-400 text-xs">dz-bridge.com</span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-400 text-xs">dzbridge.fr</span>
            </div>
          </div>

          {/* Nav */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Plateforme</p>
            <ul className="space-y-2">
              {['À propos', 'Services', 'Opportunités', 'Roadmap', 'Équipe', 'Contact'].map((l) => (
                <li key={l}>
                  <a href={`#${l.toLowerCase().replace('é', 'e').replace('à', 'a')}`} className="text-slate-400 hover:text-white text-sm transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Contact</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>dzbridge@dzbridge.fr</li>
              <li>+33 (0) 6 13 67 82 58</li>
              <li>+33 (0) 6 16 04 28 80</li>
              <li className="pt-2 text-slate-500">France · Canada · Algérie</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">
            © 2026 DzBridge. Document confidentiel — Ne pas diffuser sans autorisation.
          </p>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-full border border-green-dz/30 text-green-dz text-xs">Phase 1 · En cours</span>
            <span className="text-slate-600 text-xs">Levée seed · €500K · 2026</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

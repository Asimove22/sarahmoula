import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarClock, FileText, LayoutDashboard, Search, Settings } from 'lucide-react';
import { t } from '../i18n';
import { AiSwitch, LangSwitch, Logo } from './Brand';
import { Toaster } from './ui';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/contrats', label: 'Contrats', icon: FileText },
  { to: '/kpi', label: 'KPI & graphiques', icon: BarChart3 },
  { to: '/echeances', label: 'Échéancier', icon: CalendarClock },
  { to: '/recherche', label: 'Recherche', icon: Search },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

export function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="relative shrink-0 overflow-hidden bg-ink-900 text-slate-300 md:w-60">
        <div className="px-4 py-5">
          <Logo dark />
        </div>
        <form
          className="px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate(`/recherche?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            className="w-full rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder={t('Rechercher…')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <nav className="relative z-10 flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'hover:bg-ink-800 hover:text-white'}`
              }
            >
              <Icon size={17} /> {t(label)}
            </NavLink>
          ))}
        </nav>
        {/* Bandes obliques en pied de barre latérale, reprises de l'identité graphique. */}
        <div className="pointer-events-none absolute -bottom-10 left-0 hidden h-44 w-full md:block" aria-hidden="true">
          <div className="absolute -left-12 bottom-0 h-full w-32 -skew-x-[14deg] bg-brand-600" />
          <div className="absolute bottom-0 left-[4.9rem] h-full w-2.5 -skew-x-[14deg] bg-brand-700" />
          <div className="absolute bottom-0 left-[5.7rem] h-full w-3 -skew-x-[14deg] bg-brand-300" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex h-12 shrink-0 items-center justify-end overflow-hidden border-b border-slate-200 bg-white">
          {/* Bande rouge oblique en trois tons derrière les sélecteurs */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[min(540px,100%)]" aria-hidden="true">
            <div className="absolute inset-y-0 -left-6 w-5 -skew-x-[18deg] bg-brand-300" />
            <div className="absolute inset-y-0 -left-1 w-3 -skew-x-[18deg] bg-brand-700" />
            <div className="absolute inset-y-0 left-2 right-[-40px] -skew-x-[18deg] bg-brand-600" />
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-3 px-4">
            <AiSwitch />
            <LangSwitch />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}

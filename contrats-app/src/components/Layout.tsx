import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarClock, FileText, LayoutDashboard, Search } from 'lucide-react';
import { Toaster } from './ui';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/contrats', label: 'Contrats', icon: FileText },
  { to: '/echeances', label: 'Échéancier', icon: CalendarClock },
  { to: '/recherche', label: 'Recherche', icon: Search },
];

export function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="shrink-0 bg-slate-900 text-slate-300 md:w-56">
        <div className="flex items-center gap-2 px-4 py-4 text-white">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Gestion contractuelle</div>
            <div className="text-[11px] text-slate-400">Contrats · GED · Early Warnings</div>
          </div>
        </div>
        <form
          className="px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate(`/recherche?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'}`
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

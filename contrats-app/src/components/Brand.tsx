import { useCallback, useEffect, useState } from 'react';
import { Cloud, HardDrive, PowerOff } from 'lucide-react';
import { api, type Rec } from '../api';
import { t, useLang } from '../i18n';
import { toast, toastError } from './ui';

/** Marque Clausia : parallélogramme rouge à bandes obliques et « § » des clauses. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points="17,3 63,3 47,61 1,61" fill="#D7000F" />
      <polygon points="52,3 57,3 41,61 36,61" fill="#B3000C" />
      <polygon points="57,3 63,3 47,61 41,61" fill="#F19A97" />
      <text x="33" y="47" transform="skewX(-12)" textAnchor="middle" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontWeight="900" fontSize="42" fill="#fff">
        §
      </text>
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <div className={`text-[22px] font-black italic tracking-tight ${dark ? 'text-white' : 'text-ink-900'}`}>Clausia</div>
        <div className={`mt-1 whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.16em] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t('Gestion contractuelle')}</div>
      </div>
    </div>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex overflow-hidden rounded-md border border-white/40 text-xs font-semibold" role="group" aria-label="Langue / Language">
      {(['fr', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 uppercase ${lang === l ? 'bg-white text-brand-700' : 'text-white hover:bg-white/15'}`} aria-pressed={lang === l}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Bascule rapide du moteur d'IA, avec voyant d'état de chaque moteur. */
export function AiSwitch() {
  const [status, setStatus] = useState<Rec | null>(null);
  const load = useCallback(() => {
    api.get<Rec>('/api/ai/status').then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const choose = async (mode: string) => {
    if (mode === 'claude' && !status?.claude.configured) {
      toast(t('Ajoutez d’abord votre clé API Claude dans Paramètres.'), 'error');
      return;
    }
    try {
      setStatus(await api.put<Rec>('/api/ai/mode', { mode }));
      toast(mode === 'off' ? t('Assistant IA désactivé') : t('IA active : {name}', { name: mode === 'claude' ? 'Claude' : t('locale (Ollama)') }));
    } catch (e) {
      toastError(e);
    }
  };

  const dot = (state: 'ok' | 'warn' | 'ko' | 'none') =>
    ({ ok: 'bg-emerald-400', warn: 'bg-amber-300', ko: 'bg-red-900', none: 'bg-white/40' })[state];
  const ollamaState = !status ? 'none' : status.ollama.ok ? (status.ollama.model_present ? 'ok' : 'warn') : 'ko';
  const ollamaTitle = !status
    ? ''
    : status.ollama.ok
      ? status.ollama.model_present
        ? t('Ollama prêt ({model})', { model: status.ollama.model })
        : t('Ollama démarré, mais le modèle {model} n’est pas installé : ollama pull {model}', { model: status.ollama.model })
      : t('Ollama ne répond pas sur {url}', { url: status.ollama.url });
  const options = [
    { id: 'ollama', label: t('Locale'), icon: HardDrive, state: ollamaState, title: ollamaTitle },
    { id: 'claude', label: 'Claude', icon: Cloud, state: status?.claude.configured ? 'ok' : 'none', title: status?.claude.configured ? t('Clé API enregistrée ({model})', { model: status.claude.model }) : t('Aucune clé API (Paramètres)') },
    { id: 'off', label: t('Off'), icon: PowerOff, state: 'none', title: t('Assistant IA désactivé') },
  ] as const;

  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-xs font-semibold uppercase tracking-wider text-white/80 sm:inline">{t('IA')}</span>
      <div className="flex overflow-hidden rounded-md border border-white/40 text-xs font-semibold" role="group">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            title={o.title}
            aria-pressed={status?.mode === o.id}
            className={`flex items-center gap-1 px-2 py-1 ${status?.mode === o.id ? 'bg-white text-brand-700' : 'text-white hover:bg-white/15'}`}
          >
            <o.icon size={13} />
            {o.label}
            {o.id !== 'off' && <span className={`h-1.5 w-1.5 rounded-full ${dot(o.state)}`} />}
          </button>
        ))}
      </div>
    </div>
  );
}

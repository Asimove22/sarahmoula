import { useEffect, useState } from 'react';
import { Cloud, HardDrive, PlugZap, Power, Save, ScanText } from 'lucide-react';
import { api, type Rec } from '../api';
import { toast, toastError } from '../components/ui';

const CLAUDE_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommandé, le plus fiable)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (plus économique)' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (le plus rapide et le moins cher)' },
];

export function Settings() {
  const [s, setS] = useState<Rec | null>(null);
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState('');
  const [health, setHealth] = useState<Rec | null>(null);
  const [backups, setBackups] = useState<Rec[]>([]);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    api.get<Rec>('/api/settings').then(setS).catch(toastError);
    api.get<Rec>('/api/health').then(setHealth).catch(() => {});
    api.get('/api/backups').then(setBackups).catch(() => {});
  }, []);
  if (stopped)
    return (
      <div className="card max-w-xl p-6 text-sm">
        <p className="font-semibold">L’application est arrêtée.</p>
        <p className="mt-1 text-slate-500">Vous pouvez fermer cette fenêtre. Pour la relancer : icône « Gestion contractuelle » du Bureau.</p>
      </div>
    );
  if (!s) return <div className="text-sm text-slate-500">Chargement…</div>;
  const set = (k: string, v: string) => setS({ ...s, [k]: v });

  const save = async (extra: Rec = {}) => {
    try {
      const { has_claude_key: _ignored, ...values } = s;
      setS(await api.put<Rec>('/api/settings', { ...values, claude_api_key: key || undefined, ...extra }));
      setKey('');
      toast('Paramètres enregistrés');
    } catch (e) {
      toastError(e);
    }
  };

  const test = async (provider: string) => {
    setTesting(provider);
    try {
      await save();
      const out = await api.post('/api/ai/test', { provider });
      toast(`Connexion ${provider === 'claude' ? 'Claude' : 'Ollama'} réussie (réponse : ${out.reply})`);
    } catch (e) {
      toastError(e);
    } finally {
      setTesting('');
    }
  };

  const field = (k: string, label: string, props: Rec = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      {props.multiline ? (
        <textarea className="input min-h-[70px]" value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="input" value={s[k] ?? ''} placeholder={props.placeholder} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">En-tête des courriers</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('company_name', 'Société')}
          {field('city', 'Ville (pour « Lyon, le … »)')}
          <div className="sm:col-span-2">{field('company_address', 'Adresse (plusieurs lignes)', { multiline: true })}</div>
          {field('signatory_name', 'Signataire')}
          {field('signatory_title', 'Fonction du signataire')}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <HardDrive size={18} /> IA locale (Ollama) – utilisée par défaut
        </h2>
        <p className="text-sm text-slate-500">
          Gratuite, rien ne quitte votre PC. Installation : <a className="text-indigo-700 underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a>, puis dans un terminal : <code className="rounded bg-slate-100 px-1">ollama pull {s.ollama_model}</code>. Prévoir 16 Go de RAM.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Assistant IA</span>
            <select className="input" value={s.ai_mode} onChange={(e) => set('ai_mode', e.target.value)}>
              <option value="ollama">Activé (Ollama)</option>
              <option value="off">Désactivé</option>
            </select>
          </label>
          {field('ollama_url', 'Adresse Ollama')}
          {field('ollama_model', 'Modèle', { placeholder: 'qwen2.5:7b' })}
        </div>
        <button className="btn-secondary" onClick={() => test('ollama')} disabled={testing !== ''}>
          <PlugZap size={16} /> {testing === 'ollama' ? 'Test…' : 'Tester Ollama'}
        </button>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Cloud size={18} /> Claude (cloud) – activable contrat par contrat
        </h2>
        <p className="text-sm text-slate-500">
          Analyse de meilleure qualité. Les extraits de documents sont envoyés à l’API Anthropic, facturée à l’usage. Claude n’est utilisé que pour les contrats où la case « Autoriser l’IA cloud » est cochée (fiche contrat → Modifier).
          Clé API : <a className="text-indigo-700 underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Clé API {s.has_claude_key && <span className="text-emerald-700">(enregistrée)</span>}</span>
            <input className="input" type="password" autoComplete="off" placeholder={s.has_claude_key ? '•••••••• (laisser vide pour conserver)' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Modèle</span>
            <select className="input" value={s.claude_model} onChange={(e) => set('claude_model', e.target.value)}>
              {CLAUDE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Niveau de réflexion</span>
            <select className="input" value={s.claude_effort} onChange={(e) => set('claude_effort', e.target.value)}>
              <option value="low">Faible (rapide, économique)</option>
              <option value="medium">Moyen (recommandé)</option>
              <option value="high">Élevé (analyses complexes, plus cher)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => test('claude')} disabled={testing !== '' || (!s.has_claude_key && !key)}>
            <PlugZap size={16} /> {testing === 'claude' ? 'Test…' : 'Tester Claude'}
          </button>
          {s.has_claude_key && (
            <button className="btn-danger" onClick={() => confirm('Supprimer la clé API enregistrée ?') && save({ remove_claude_key: true })}>
              Supprimer la clé
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">La clé est stockée dans la base locale (data/contrats.db) et n’est jamais renvoyée à l’interface.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <ScanText size={18} /> Automatismes
        </h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={s.ocr_mode !== 'off'} onChange={(e) => set('ocr_mode', e.target.checked ? 'on' : 'off')} />
          <span>
            <b>OCR des documents scannés</b> (PDF image, photos) — local, hors ligne, français et anglais. Le texte reconnu devient consultable par la recherche et l’IA.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={s.review_watch_ai !== 'off'} onChange={(e) => set('review_watch_ai', e.target.checked ? 'on' : 'off')} />
          <span>
            <b>Veille de revue par l’IA</b> — à chaque nouvel événement (courrier, EW, CE, avenant, planning, pièce contractuelle), l’IA propose des mises à jour de la revue. Les règles métier fonctionnent toujours, même décoché. Avec Claude, chaque événement consomme un peu de crédit API.
          </span>
        </label>
      </section>

      <button className="btn-primary" onClick={() => save()}>
        <Save size={16} /> Enregistrer
      </button>

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-semibold">Application</h2>
        <p className="text-slate-600">Version {health?.version ?? '—'} · données stockées localement.</p>
        <div>
          <div className="label">Sauvegardes automatiques de la base (une par jour, 14 conservées)</div>
          {backups.length ? (
            <ul className="text-xs text-slate-600">
              {backups.slice(0, 5).map((b) => (
                <li key={b.name}>
                  {`data\\sauvegardes-auto\\${b.name}`} ({Math.round(b.size / 1024)} Ko)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Aucune pour l’instant.</p>
          )}
          <p className="mt-1 text-xs text-slate-400">Les documents ne sont jamais modifiés ni effacés (corbeille). Pour une copie complète sur clé USB : Sauvegarder.bat.</p>
        </div>
        <button
          className="btn-danger"
          onClick={async () => {
            if (!confirm('Arrêter l’application ? Les alertes ne seront plus calculées jusqu’au prochain lancement.')) return;
            await api.post('/api/system/shutdown', {}).catch(() => {});
            setStopped(true);
          }}
        >
          <Power size={16} /> Arrêter l’application
        </button>
      </section>
    </div>
  );
}

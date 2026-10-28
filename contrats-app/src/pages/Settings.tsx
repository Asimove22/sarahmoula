import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, Download, HardDrive, PlugZap, Power, RefreshCw, Save, ScanText, TriangleAlert } from 'lucide-react';
import { api, type Rec } from '../api';
import { toast, toastError } from '../components/ui';
import { t } from '../i18n';

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
        <p className="font-semibold">{t('L’application est arrêtée.')}</p>
        <p className="mt-1 text-slate-500">{t('Vous pouvez fermer cette fenêtre. Pour la relancer : icône « Gestion contractuelle » du Bureau.')}</p>
      </div>
    );
  if (!s) return <div className="text-sm text-slate-500">{t('Chargement…')}</div>;
  const set = (k: string, v: string) => setS({ ...s, [k]: v });

  const save = async (extra: Rec = {}) => {
    try {
      // ai_mode est piloté par le sélecteur de l'en-tête : on ne le renvoie pas pour ne pas l'écraser.
      const { has_claude_key: _ignored, ai_mode: _mode, ...values } = s;
      setS(await api.put<Rec>('/api/settings', { ...values, claude_api_key: key || undefined, ...extra }));
      setKey('');
      toast(t('Paramètres enregistrés'));
    } catch (e) {
      toastError(e);
    }
  };

  const test = async (provider: string) => {
    setTesting(provider);
    try {
      await save();
      const out = await api.post('/api/ai/test', { provider });
      toast(t('Connexion {name} réussie (modèle {model}, réponse : {reply})', { name: provider === 'claude' ? 'Claude' : 'Ollama', model: out.model ?? '', reply: out.reply }));
    } catch (e) {
      toastError(e);
    } finally {
      setTesting('');
    }
  };

  const field = (k: string, label: string, props: Rec = {}) => (
    <label className="block">
      <span className="label">{t(label)}</span>
      {props.multiline ? (
        <textarea className="input min-h-[70px]" value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="input" value={s[k] ?? ''} list={props.list} placeholder={props.placeholder && t(props.placeholder)} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">{t('Paramètres')}</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{t('En-tête des courriers')}</h2>
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
          <HardDrive size={18} /> {t('IA locale (Ollama)')}
        </h2>
        <p className="text-sm text-slate-500">
          {t('Gratuite, rien ne quitte votre PC. Installation :')} <a className="text-brand-700 underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">{t('ollama.com/download')}</a>{t(', puis dans un terminal :')} <code className="rounded bg-slate-100 px-1">{t('ollama pull')} {s.ollama_model}</code>{t('. Prévoir 16 Go de RAM.')}
        </p>
        <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">
          {t('Le moteur actif se choisit dans la barre rouge en haut de l’écran (Locale / Claude / Off). Chaque contrat peut imposer son propre moteur (fiche contrat → Modifier → Moteur d’IA), par exemple « toujours en local » pour un marché confidentiel.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('ollama_url', 'Adresse Ollama')}
          {field('ollama_model', 'Modèle', { placeholder: 'qwen2.5:7b', list: 'ollama-models' })}
        </div>
        <OllamaStatus model={s.ollama_model} onUse={(m) => save({ ollama_model: m })} />
        <button className="btn-secondary" onClick={() => test('ollama')} disabled={testing !== ''}>
          <PlugZap size={16} /> {testing === 'ollama' ? t('Test…') : t('Tester Ollama')}
        </button>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Cloud size={18} /> {t('Claude (cloud)')}
        </h2>
        <p className="text-sm text-slate-500">
          {t('Analyse de meilleure qualité. Les extraits de documents sont envoyés à l’API Anthropic, facturée à l’usage. Claude est utilisé quand il est sélectionné dans la barre du haut, sauf pour les contrats réglés sur « toujours en local ». Clé API :')} <a className="text-brand-700 underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">{t('console.anthropic.com')}</a>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t('Clé API')} {s.has_claude_key && <span className="text-emerald-700">{t('(enregistrée)')}</span>}</span>
            <input className="input" type="password" autoComplete="off" placeholder={s.has_claude_key ? t('•••••••• (laisser vide pour conserver)') : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">{t('Modèle')}</span>
            <select className="input" value={s.claude_model} onChange={(e) => set('claude_model', e.target.value)}>
              {CLAUDE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t('Niveau de réflexion')}</span>
            <select className="input" value={s.claude_effort} onChange={(e) => set('claude_effort', e.target.value)}>
              <option value="low">{t('Faible (rapide, économique)')}</option>
              <option value="medium">{t('Moyen (recommandé)')}</option>
              <option value="high">{t('Élevé (analyses complexes, plus cher)')}</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => test('claude')} disabled={testing !== '' || (!s.has_claude_key && !key)}>
            <PlugZap size={16} /> {testing === 'claude' ? t('Test…') : t('Tester Claude')}
          </button>
          {s.has_claude_key && (
            <button className="btn-danger" onClick={() => confirm(t('Supprimer la clé API enregistrée ?')) && save({ remove_claude_key: true })}>
              {t('Supprimer la clé')}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">{t('La clé est stockée dans la base locale (data/contrats.db) et n’est jamais renvoyée à l’interface.')}</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <ScanText size={18} /> {t('Automatismes')}
        </h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={s.ocr_mode !== 'off'} onChange={(e) => set('ocr_mode', e.target.checked ? 'on' : 'off')} />
          <span>
            <b>{t('OCR des documents scannés')}</b> {t('(PDF image, photos) — local, hors ligne, français et anglais. Le texte reconnu devient consultable par la recherche et l’IA.')}
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={s.review_watch_ai !== 'off'} onChange={(e) => set('review_watch_ai', e.target.checked ? 'on' : 'off')} />
          <span>
            <b>{t('Veille de revue par l’IA')}</b> {t('— à chaque nouvel événement (courrier, EW, CE, avenant, planning, pièce contractuelle), l’IA propose des mises à jour de la revue. Les règles métier fonctionnent toujours, même décoché. Avec Claude, chaque événement consomme un peu de crédit API.')}
          </span>
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{t('Marchés publics')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('ecb_rate', 'Taux de la BCE (%)', { placeholder: 'ex. 2.15' })}
        </div>
        <p className="text-xs text-slate-500">
          {t('Taux d’intérêt des opérations principales de refinancement de la BCE en vigueur au premier jour du semestre où les intérêts ont commencé à courir. Les intérêts moratoires sont calculés à ce taux majoré de 8 points (CCP, art. R2192-31). Mettez-le à jour chaque semestre.')}
        </p>
      </section>

      <button className="btn-primary" onClick={() => save()}>
        <Save size={16} /> {t('Enregistrer')}
      </button>

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-semibold">{t('Application')}</h2>
        <p className="text-slate-600">{t('Version')} {health?.version ?? '—'} {t('· données stockées localement.')}</p>
        <div>
          <div className="label">{t('Sauvegardes automatiques de la base (une par jour, 14 conservées)')}</div>
          {backups.length ? (
            <ul className="text-xs text-slate-600">
              {backups.slice(0, 5).map((b) => (
                <li key={b.name}>
                  {`data\\sauvegardes-auto\\${b.name}`} ({Math.round(b.size / 1024)} {t('Ko)')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">{t('Aucune pour l’instant.')}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">{t('Les documents ne sont jamais modifiés ni effacés (corbeille). Pour une copie complète sur clé USB : Sauvegarder.bat.')}</p>
        </div>
        <button
          className="btn-danger"
          onClick={async () => {
            if (!confirm(t('Arrêter l’application ? Les alertes ne seront plus calculées jusqu’au prochain lancement.'))) return;
            await api.post('/api/system/shutdown', {}).catch(() => {});
            setStopped(true);
          }}
        >
          <Power size={16} /> {t('Arrêter l’application')}
        </button>
      </section>
    </div>
  );
}

/** État d'Ollama : joignable ? modèle installé ? Téléchargement du modèle depuis l'application. */
function OllamaStatus({ model, onUse }: { model: string; onUse: (m: string) => void }) {
  const [st, setSt] = useState<Rec | null>(null);
  const load = () => api.get<Rec>('/api/ai/status').then(setSt).catch(() => {});
  const pulling = st?.ollama.pull && !st.ollama.pull.done;
  useEffect(() => {
    load();
  }, [model]);
  useEffect(() => {
    if (!pulling) return;
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [pulling]);
  // Message de fin seulement pour un téléchargement suivi sur cette page (pas pour un ancien).
  const wasPulling = useRef(false);
  useEffect(() => {
    const p = st?.ollama.pull;
    if (wasPulling.current && p?.done) toast(p.error ?? t('Modèle {model} installé : l’IA locale est prête.', { model: p.model }), p.error ? 'error' : 'ok');
    wasPulling.current = Boolean(pulling);
  }, [pulling, st?.ollama.pull?.done]);

  const install = async () => {
    try {
      setSt(await api.post<Rec>('/api/ai/ollama/pull', { model }));
    } catch (e) {
      toastError(e);
    }
  };
  if (!st) return null;
  const o = st.ollama;
  const p = o.pull;
  const pct = p?.total ? Math.round((p.completed / p.total) * 100) : 0;
  const gb = (n: number) => (n / 1e9).toFixed(1);

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
      <datalist id="ollama-models">{o.models.map((m: string) => <option key={m} value={m} />)}</datalist>
      {!o.ok ? (
        <div className="flex items-start gap-2 text-red-700">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            {t('Ollama ne répond pas sur {url}', { url: o.url })}. {t('Installez-le depuis ollama.com/download, puis lancez-le (icône Ollama près de l’horloge Windows).')}
          </div>
        </div>
      ) : pulling ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>{t('Téléchargement de {model}…', { model: p.model })} {p.status}</span>
            <span className="tabular-nums">{p.total ? `${gb(p.completed)} / ${gb(p.total)} Go · ${pct} %` : ''}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('Vous pouvez continuer à utiliser l’application pendant le téléchargement.')}</p>
        </div>
      ) : o.model_exact ? (
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 size={16} /> {t('IA locale prête : modèle {model} installé.', { model: o.model_used })}
        </div>
      ) : o.model_present ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-amber-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{t('« {wanted} » n’est pas installé ; la variante « {used} » est utilisée à sa place.', { wanted: model, used: o.model_used })}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => onUse(o.model_used)}>{t('Utiliser {model}', { model: o.model_used })}</button>
            <button className="btn-secondary" onClick={install}><Download size={16} /> {t('Installer {model}', { model })}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-amber-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              {t('Ollama fonctionne, mais le modèle « {model} » n’est pas installé.', { model })}{' '}
              {o.models.length ? t('Modèles présents : {list}.', { list: o.models.join(', ') }) : t('Aucun modèle installé.')}
            </span>
          </div>
          {p?.error && p.model === String(model).trim().toLowerCase().replace(/\s+/g, '') && <p className="text-xs text-red-700">{p.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={install}>
              <Download size={16} /> {t('Installer le modèle {model} (≈ 4,7 Go)', { model })}
            </button>
            {/* Ou se contenter d'un modèle déjà présent, sans téléchargement. */}
            {o.models.map((m: string) => (
              <button key={m} className="btn-secondary" onClick={() => onUse(m)}>{t('Utiliser {model}', { model: m })}</button>
            ))}
          </div>
        </div>
      )}
      <button className="btn-ghost !px-0 text-xs" onClick={load}><RefreshCw size={13} /> {t('Vérifier à nouveau')}</button>
    </div>
  );
}

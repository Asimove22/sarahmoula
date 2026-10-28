// Assistant IA : Ollama (local, par défaut) ou API Claude (activable contrat par contrat).
import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from './db.js';

export const AI_DEFAULTS = {
  ai_mode: 'ollama', // moteur par défaut : 'ollama' | 'claude' | 'off'
  ollama_url: 'http://localhost:11434',
  ollama_model: 'qwen2.5:7b',
  claude_model: 'claude-opus-5-5',
  claude_effort: 'medium',
};

// Volume de texte transmis au modèle : un modèle local a une fenêtre de contexte bien plus petite.
const LIMITS = { ollama: 40_000, claude: 600_000 };

export class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Quel moteur utiliser pour ce contrat ? */
/** Moteur effectif : le réglage du contrat s'il en a un, sinon le moteur choisi dans l'en-tête. */
export function effectiveMode(db, contract) {
  const s = { ...AI_DEFAULTS, ...getSettings(db) };
  return contract?.ai_provider || s.ai_mode || 'ollama';
}

export function resolveProvider(db, contract) {
  const s = { ...AI_DEFAULTS, ...getSettings(db) };
  const mode = effectiveMode(db, contract);
  if (mode === 'claude') {
    if (!s.claude_api_key) throw new AiError('Claude est sélectionné, mais aucune clé API n’est enregistrée (Paramètres).');
    return { name: 'claude', settings: s };
  }
  if (mode === 'ollama') return { name: 'ollama', settings: s };
  throw new AiError('L’assistant IA est désactivé (sélecteur IA en haut de l’écran).');
}

const ollamaBase = (s) => s.ollama_url.replace(/\/$/, '');

/** Modèles installés dans Ollama (null si Ollama ne répond pas). */
async function ollamaModels(s, timeout = 1500) {
  try {
    const res = await fetch(`${ollamaBase(s)}/api/tags`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return null;
  }
}

// « Qwen 2.5:7b » ou « qwen2.5 » désignent le même modèle que « qwen2.5:7b » / « qwen2.5:latest ».
const normalizeModel = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, '');
const withTag = (name) => (name.includes(':') ? name : `${name}:latest`);

/**
 * Modèle réellement utilisable : nom exact, sinon même nom écrit autrement, sinon une autre taille
 * de la même famille (ex. qwen2.5:latest à la place de qwen2.5:7b). null si rien ne convient.
 */
export function pickOllamaModel(wanted, installed) {
  if (!installed?.length) return null;
  const w = withTag(normalizeModel(wanted));
  const exact = installed.find((m) => withTag(normalizeModel(m)) === w);
  if (exact) return { name: exact, exact: true };
  const family = w.split(':')[0];
  const same = installed.filter((m) => normalizeModel(m).split(':')[0] === family);
  if (same.length) return { name: same.find((m) => m.endsWith(':latest')) ?? same[0], exact: false };
  return null;
}

// Téléchargement d'un modèle lancé depuis l'application (un seul à la fois).
let pull = null;

/** Lance « ollama pull » via l'API d'Ollama ; la progression est lisible dans aiStatus(). */
export async function startOllamaPull(db, model) {
  const s = { ...AI_DEFAULTS, ...getSettings(db) };
  const name = normalizeModel(model || s.ollama_model);
  if (!name) throw new AiError('Indiquez le modèle à installer.');
  if (pull && !pull.done) return pull;
  if ((await ollamaModels(s)) === null) throw new AiError(`Ollama ne répond pas sur ${s.ollama_url}. Installez-le (ollama.com/download) et démarrez-le, puis réessayez.`, 503);
  pull = { model: name, status: 'démarrage', completed: 0, total: 0, done: false, error: null };
  const state = pull;
  (async () => {
    try {
      const res = await fetch(`${ollamaBase(s)}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, stream: true }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      const decoder = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
        buf += decoder.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.error) throw new Error(ev.error);
          state.status = ev.status ?? state.status;
          if (ev.total) {
            state.total = ev.total;
            state.completed = ev.completed ?? 0;
          }
        }
      }
      if (state.status !== 'success') throw new Error('téléchargement interrompu');
    } catch (e) {
      state.error = /file does not exist|not found|manifest/i.test(e.message)
        ? `Le modèle « ${name} » n’existe pas sur ollama.com. Vérifiez son nom (ex. qwen2.5:7b).`
        : `Téléchargement impossible : ${e.message}`;
    } finally {
      state.done = true;
    }
  })();
  return state;
}

/** État des moteurs pour le sélecteur de l'en-tête (Ollama joignable ? modèle installé ? clé Claude ?). */
export async function aiStatus(db) {
  const s = { ...AI_DEFAULTS, ...getSettings(db) };
  const models = await ollamaModels(s);
  const picked = pickOllamaModel(s.ollama_model, models);
  const ollama = {
    ok: models !== null,
    models: models ?? [],
    // présent = utilisable : le nom exact ou une variante de la même famille (utilisée à sa place)
    model_present: Boolean(picked),
    model_exact: Boolean(picked?.exact),
    model_used: picked?.name ?? null,
  };
  return {
    mode: s.ai_mode,
    ollama: { ...ollama, url: s.ollama_url, model: s.ollama_model, pull },
    claude: { configured: Boolean(s.claude_api_key), model: s.claude_model },
  };
}

async function complete(provider, { system, prompt, schema }) {
  const { name, settings: s } = provider;
  if (name === 'ollama') {
    const installed = await ollamaModels(s, 5000);
    if (installed === null) throw new AiError(`Ollama ne répond pas sur ${s.ollama_url}. Lancez Ollama (icône Ollama ou « ollama serve ») ou vérifiez l’adresse dans Paramètres.`, 503);
    const picked = pickOllamaModel(s.ollama_model, installed);
    if (!picked) {
      throw new AiError(
        `Modèle « ${s.ollama_model} » absent d’Ollama${installed.length ? ` (modèles installés : ${installed.join(', ')})` : ' (aucun modèle installé)'}. `
          + `Paramètres → IA locale → « Installer le modèle », ou dans un terminal : ollama pull ${normalizeModel(s.ollama_model)}`,
        503,
      );
    }
    let res;
    try {
      res = await fetch(`${s.ollama_url.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: picked.name,
          stream: false,
          format: schema ?? undefined,
          options: { num_ctx: 16384, temperature: 0.2 },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(10 * 60_000),
      });
    } catch {
      throw new AiError(`Ollama ne répond pas sur ${s.ollama_url}. Lancez Ollama (ollama serve) ou vérifiez l’adresse dans Paramètres.`, 503);
    }
    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 404) throw new AiError(`Modèle « ${picked.name} » absent : Paramètres → IA locale → « Installer le modèle », ou « ollama pull ${picked.name} ».`, 503);
      throw new AiError(`Erreur Ollama ${res.status} : ${detail.slice(0, 300)}`, 502);
    }
    const data = await res.json();
    return data.message?.content ?? '';
  }

  const client = new Anthropic({ apiKey: s.claude_api_key });
  let response;
  try {
    response = await client.beta.messages.create({
      model: s.claude_model,
      max_tokens: 16000,
      // En cas de refus par un filtre de sécurité, l'API relance la requête sur un modèle de repli.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: s.claude_effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Clé API Claude invalide (Paramètres).', 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de requêtes Claude atteinte : réessayez dans un instant.', 429);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Impossible de joindre l’API Claude (connexion Internet ?).', 503);
    if (e instanceof Anthropic.APIError) throw new AiError(`Erreur API Claude ${e.status} : ${e.message}`, 502);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new AiError('Claude a refusé de traiter cette demande.', 422);
  if (response.stop_reason === 'max_tokens') throw new AiError('Réponse de Claude tronquée (trop longue) : réduisez le nombre de documents analysés.', 422);
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function completeJson(provider, args) {
  const text = await complete(provider, args);
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new AiError('La réponse de l’IA n’est pas un JSON valide : réessayez ou changez de modèle.', 502);
  }
}

/** Assemble les textes sous la limite du moteur, en signalant ce qui n'a pas pu être transmis. */
function packDocuments(provider, docs) {
  const limit = LIMITS[provider.name];
  let used = 0;
  const parts = [];
  const omitted = [];
  for (const d of docs) {
    const room = limit - used;
    if (room < 2000) {
      omitted.push(d.title);
      continue;
    }
    const text = d.content_text.length > room ? d.content_text.slice(0, room) : d.content_text;
    if (text.length < d.content_text.length) omitted.push(`${d.title} (partiellement)`);
    parts.push(`<document titre="${d.title}" categorie="${d.category}">\n${text}\n</document>`);
    used += text.length;
  }
  return { text: parts.join('\n\n'), omitted };
}

const SYSTEM = `Tu es un juriste et ingénieur contrats expert en marchés de travaux (NEC3/NEC4, CCAG Travaux, droit français).
Tu réponds en français, de façon précise et factuelle, en citant les clauses et articles quand le texte les donne.
Tu ne fabriques jamais une information absente des documents : si elle manque, dis-le.`;

const contractHeader = (c) =>
  `Contrat : ${c.title}${c.reference ? ` (réf. ${c.reference})` : ''} – cadre ${c.framework}${c.nec_option ? ` option ${c.nec_option}` : ''} – mon rôle : ${c.my_role ?? 'non précisé'}.`;

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'review_items', 'key_dates', 'obligations'],
  properties: {
    summary: { type: 'string' },
    review_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'clause_ref', 'content', 'risk_level', 'mitigation'],
        properties: {
          theme: { type: 'string' },
          clause_ref: { type: 'string' },
          content: { type: 'string' },
          risk_level: { type: 'string', enum: ['faible', 'moyen', 'élevé', 'critique'] },
          mitigation: { type: 'string' },
        },
      },
    },
    key_dates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'date', 'clause_ref'],
        properties: { title: { type: 'string' }, date: { type: 'string' }, clause_ref: { type: 'string' } },
      },
    },
    obligations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'clause_ref', 'deadline'],
        properties: { title: { type: 'string' }, clause_ref: { type: 'string' }, deadline: { type: 'string' } },
      },
    },
  },
};

/** Revue de contrat assistée : clauses à risque, dates clés et obligations à délai. */
export async function reviewContract(db, contract, docs) {
  if (!docs.length) throw new AiError('Aucun document texte à analyser : déposez le contrat, le CCAP, le CCTP… (les PDF scannés sans texte ne sont pas lisibles).');
  const provider = resolveProvider(db, contract);
  const { text, omitted } = packDocuments(provider, docs);
  const result = await completeJson(provider, {
    system: SYSTEM,
    schema: REVIEW_SCHEMA,
    prompt: `${contractHeader(contract)}

Réalise la revue de ce contrat à partir des documents ci-dessous.
- summary : synthèse en 5 à 10 lignes (objet, prix, durée, points sensibles).
- review_items : les clauses à analyser, notamment pénalités et leur plafond, retenue de garantie et garanties, avances, révision des prix, délais de paiement, délais de notification et forclusions, réception et garanties post-réception, assurances, responsabilité et plafonds, résiliation, règlement des litiges, sous-traitance, propriété intellectuelle, et pour la NEC les Z-clauses et options secondaires. Pour chacune : thème, référence de clause, contenu résumé, niveau de risque pour moi, mesure de maîtrise.
- key_dates : dates contractuelles explicites (format AAAA-MM-JJ, vide si la date n'est pas absolue).
- obligations : obligations soumises à un délai (ex. « notifier sous 8 semaines »), avec le délai en clair.

${text}`,
  });
  return { ...result, provider: provider.name, omitted };
}

/** Découpe les documents en passages et garde ceux qui contiennent le plus de mots de la question. */
function bestPassages(docs, question, max) {
  const words = [...new Set(question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3))];
  const passages = [];
  for (const d of docs) {
    const plain = d.content_text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (let i = 0; i < d.content_text.length; i += 1500) {
      const chunk = plain.slice(i, i + 1800);
      const score = words.reduce((n, w) => n + (chunk.split(w).length - 1), 0);
      if (score) passages.push({ score, doc: d, text: d.content_text.slice(i, i + 1800) });
    }
  }
  return passages.sort((a, b) => b.score - a.score).slice(0, max);
}

/** Question libre sur le contrat, avec les passages pertinents des documents. */
export async function askContract(db, contract, docs, question) {
  const provider = resolveProvider(db, contract);
  const passages = bestPassages(docs, question, provider.name === 'claude' ? 60 : 12);
  const context = passages.map((p, i) => `[${i + 1}] (${p.doc.title})\n${p.text}`).join('\n\n');
  const answer = await complete(provider, {
    system: SYSTEM,
    prompt: `${contractHeader(contract)}

Extraits des documents du contrat :
${context || '(aucun passage trouvé pour cette question)'}

Question : ${question}

Réponds en t'appuyant uniquement sur ces extraits et cite-les avec leur numéro [n]. Si la réponse n'y figure pas, dis-le et indique quel document consulter.`,
  });
  const sources = [...new Map(passages.map((p) => [p.doc.id, { id: p.doc.id, title: p.doc.title }])).values()];
  return { answer, sources, provider: provider.name };
}

/** Rédaction ou amélioration du corps d'un courrier. */
export async function draftLetter(db, contract, { subject, body, instructions, facts }) {
  const provider = resolveProvider(db, contract);
  const text = await complete(provider, {
    system: `${SYSTEM}\nTu rédiges des courriers contractuels formels, clairs et fermes, sans formule d'appel ni de politesse finale (elles sont ajoutées automatiquement).`,
    prompt: `${contractHeader(contract)}
Objet du courrier : ${subject}
Faits connus (registres) : ${JSON.stringify(facts)}
Brouillon actuel :
${body}

Consignes : ${instructions || 'Améliore la rédaction et complète les passages entre crochets avec les faits connus ; laisse entre crochets ce qui reste inconnu.'}
Rends uniquement le corps du courrier, en paragraphes séparés par une ligne vide.`,
  });
  return { body: text.trim(), provider: provider.name };
}

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'response_required', 'response_days', 'actions', 'risk', 'risk_reason'],
  properties: {
    summary: { type: 'string' },
    response_required: { type: 'boolean' },
    response_days: { type: 'integer' },
    actions: { type: 'array', items: { type: 'string' } },
    risk: { type: 'string', enum: ['aucun', 'early_warning', 'compensation_event', 'réclamation', 'mise_en_demeure'] },
    risk_reason: { type: 'string' },
  },
};

/** Analyse d'un échange reçu : résumé, réponse attendue, risque contractuel. */
export async function triageCorrespondence(db, contract, message, attachmentsText) {
  const provider = resolveProvider(db, contract);
  return {
    ...(await completeJson(provider, {
      system: SYSTEM,
      schema: TRIAGE_SCHEMA,
      prompt: `${contractHeader(contract)}
Analyse ce courrier ${message.direction === 'sortant' ? 'envoyé' : 'reçu'} et indique : un résumé (3 lignes), si une réponse est attendue et sous combien de jours, les actions à mener, et s'il révèle un risque contractuel (événement à notifier en Early Warning, Compensation Event, réclamation, mise en demeure).

Objet : ${message.subject}
De : ${message.sender ?? ''} – À : ${message.recipient ?? ''} – Date : ${message.date ?? ''}
${message.summary ?? ''}
${attachmentsText ? `\nPièces jointes :\n${attachmentsText.slice(0, LIMITS[provider.name] / 2)}` : ''}`,
    })),
    provider: provider.name,
  };
}

const WATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['updates', 'new_items'],
  properties: {
    updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['review_item_id', 'note', 'risk_level', 'status', 'mitigation', 'rationale'],
        properties: {
          review_item_id: { type: 'integer' },
          note: { type: 'string' },
          risk_level: { type: 'string', enum: ['', 'faible', 'moyen', 'élevé', 'critique'] },
          status: { type: 'string', enum: ['', 'à analyser', 'analysé', 'à négocier', 'accepté'] },
          mitigation: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
    new_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'clause_ref', 'content', 'risk_level', 'mitigation', 'rationale'],
        properties: {
          theme: { type: 'string' },
          clause_ref: { type: 'string' },
          content: { type: 'string' },
          risk_level: { type: 'string', enum: ['faible', 'moyen', 'élevé', 'critique'] },
          mitigation: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
};

/** Veille de revue : quels points de la revue un nouvel événement modifie-t-il ? */
export async function proposeReviewUpdates(db, contract, items, event) {
  const provider = resolveProvider(db, contract);
  const list = items
    .map((i) => `#${i.id} | ${i.theme} | ${i.clause_ref ?? ''} | risque : ${i.risk_level ?? '—'} | statut : ${i.status} | ${String(i.content ?? '').slice(0, 300)}`)
    .join('\n');
  const detail = String(event.detail ?? '').slice(0, provider.name === 'claude' ? 60_000 : 8_000);
  const out = await completeJson(provider, {
    system: SYSTEM,
    schema: WATCH_SCHEMA,
    prompt: `${contractHeader(contract)}

Voici la revue de contrat actuelle (un point par ligne, identifiant après #) :
${list}

Nouvel événement : ${event.label}
${detail}

Indique uniquement les points de la revue que cet événement modifie réellement (nouveau risque, risque réduit, clause à renégocier, mesure de maîtrise à ajouter) :
- updates : review_item_id (identifiant #), note (ce qui change, 1 à 2 phrases), risk_level et status (chaîne vide si inchangé), mitigation (vide si inchangée), rationale.
- new_items : seulement si l'événement révèle un sujet qu'aucun point ne couvre.
Si l'événement ne change rien, renvoie des listes vides. Ne propose pas de modification par précaution.`,
  });
  return {
    updates: (out.updates ?? []).map((u) => ({ ...u, risk_level: u.risk_level || null, status: u.status || null, mitigation: u.mitigation || null })),
    new_items: out.new_items ?? [],
  };
}

/** Test de connexion depuis la page Paramètres. */
export async function testProvider(db, which) {
  const s = { ...AI_DEFAULTS, ...getSettings(db) };
  if (which === 'claude' && !s.claude_api_key) throw new AiError('Aucune clé API Claude enregistrée.');
  const text = await complete({ name: which, settings: s }, { system: 'Réponds uniquement par OK.', prompt: 'Test de connexion.' });
  const used = which === 'ollama' ? pickOllamaModel(s.ollama_model, await ollamaModels(s))?.name : s.claude_model;
  return { ok: true, reply: text.trim().slice(0, 50), model: used };
}

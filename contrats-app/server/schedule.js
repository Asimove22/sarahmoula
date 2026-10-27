// Import de plannings (MS Project XML, Primavera P6 XER, Excel / CSV) et calcul du chemin critique.
import { XMLParser } from 'fast-xml-parser';
import ExcelJS from 'exceljs';

const DAY = 86400000;
const isoDay = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
};
const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Types de liens : FS (fin-début), SS (début-début), FF (fin-fin), SF (début-fin).
const LINK_TYPES = { FS: 'FS', FD: 'FS', SS: 'SS', DD: 'SS', FF: 'FF', SF: 'SF', DF: 'SF', PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF' };
const MSP_LINK = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' };

/** Format détecté à partir du nom et du contenu. */
export function detectFormat(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'xer' || buffer.subarray(0, 4).toString() === 'ERMH') return 'xer';
  if (ext === 'xml') return 'msp';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  if (ext === 'mpp') throw new Error('Le format .mpp natif n’est pas lisible : dans MS Project, faites « Enregistrer sous » → « Format XML (*.xml) ».');
  throw new Error('Format de planning non reconnu (attendu : .xml MS Project, .xer Primavera, .xlsx ou .csv).');
}

export async function parseSchedule(filename, buffer) {
  const format = detectFormat(filename, buffer);
  const parsed =
    format === 'msp' ? parseMsp(buffer.toString('utf8')) : format === 'xer' ? parseXer(buffer.toString('utf8')) : await parseTable(format, buffer);
  if (!parsed.tasks.length) throw new Error('Aucune tâche trouvée dans le planning.');
  const work = parsed.tasks.filter((t) => !t.is_summary && t.start && t.finish);
  // Si le fichier ne fournit pas la marge totale, on la calcule.
  if (work.some((t) => t.total_float_days === null)) computeFloat(work);
  for (const t of work) if (t.is_critical === null) t.is_critical = t.total_float_days !== null && t.total_float_days <= 0 && (t.percent_complete ?? 0) < 100;
  const finishes = work.map((t) => t.finish).sort();
  return {
    format,
    data_date: parsed.data_date ?? null,
    planned_completion: finishes.at(-1) ?? null,
    float_source: parsed.tasks.some((t) => t.float_from_file) ? 'fichier' : 'calculée',
    tasks: parsed.tasks.map((t) => ({ ...t, is_critical: t.is_critical ? 1 : 0 })),
  };
}

function baseTask(fields) {
  return {
    ext_id: null, wbs_code: null, name: '', start: null, finish: null, baseline_start: null, baseline_finish: null,
    duration_days: null, percent_complete: null, total_float_days: null, is_critical: null, is_milestone: 0,
    is_summary: 0, outline_level: null, predecessors: [], float_from_file: false, ...fields,
  };
}

// ---------- MS Project (MSPDI XML) ----------
function parseMsp(xml) {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, isArray: (n) => ['Task', 'PredecessorLink', 'Baseline'].includes(n) });
  const project = parser.parse(xml).Project;
  if (!project) throw new Error('Fichier XML non reconnu comme un export MS Project.');
  const minutesPerDay = num(project.MinutesPerDay) || 480;
  const tasks = [];
  for (const t of project.Tasks?.Task ?? []) {
    if (t.UID === '0' || !t.Name) continue;
    const hours = parseIsoDuration(t.Duration);
    const baseline = (t.Baseline ?? []).find((b) => String(b.Number) === '0');
    const hasSlack = t.TotalSlack !== undefined && t.TotalSlack !== '';
    tasks.push(baseTask({
      ext_id: String(t.UID),
      wbs_code: t.WBS ?? null,
      name: String(t.Name),
      start: isoDay(t.Start),
      finish: isoDay(t.Finish),
      baseline_start: isoDay(baseline?.Start),
      baseline_finish: isoDay(baseline?.Finish),
      duration_days: hours === null ? null : round(hours / (minutesPerDay / 60)),
      percent_complete: num(t.PercentComplete),
      // TotalSlack est exprimé en dixièmes de minute.
      total_float_days: hasSlack ? round(num(t.TotalSlack) / 10 / minutesPerDay) : null,
      float_from_file: hasSlack,
      is_critical: t.Critical !== undefined ? t.Critical === '1' : null,
      is_milestone: t.Milestone === '1' ? 1 : 0,
      is_summary: t.Summary === '1' ? 1 : 0,
      outline_level: num(t.OutlineLevel),
      predecessors: (t.PredecessorLink ?? []).map((l) => ({
        id: String(l.PredecessorUID),
        type: MSP_LINK[l.Type] ?? 'FS',
        lag_days: round((num(l.LinkLag) ?? 0) / 10 / minutesPerDay),
      })),
    }));
  }
  return { data_date: isoDay(project.StatusDate || project.CurrentDate), tasks };
}

function parseIsoDuration(d) {
  const m = String(d ?? '').match(/PT(\d+(?:\.\d+)?)H(\d+)M/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

// ---------- Primavera P6 (XER) ----------
function parseXer(text) {
  const tables = {};
  let current = null;
  let fields = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split('\t');
    if (parts[0] === '%T') {
      current = parts[1];
      tables[current] = [];
    } else if (parts[0] === '%F') {
      fields = parts.slice(1);
    } else if (parts[0] === '%R' && current) {
      tables[current].push(Object.fromEntries(fields.map((f, i) => [f, parts[i + 1] ?? ''])));
    }
  }
  if (!tables.TASK) throw new Error('Fichier XER sans table TASK.');
  const hoursByCalendar = new Map((tables.CALENDAR ?? []).map((c) => [c.clndr_id, num(c.day_hr_cnt) || 8]));
  const wbs = new Map((tables.PROJWBS ?? []).map((w) => [w.wbs_id, w]));
  const wbsCode = (id) => {
    const parts = [];
    for (let w = wbs.get(id), guard = 0; w && w.proj_node_flag !== 'Y' && guard < 50; w = wbs.get(w.parent_wbs_id), guard++) parts.unshift(w.wbs_short_name);
    return parts.join('.') || null;
  };
  const preds = new Map();
  for (const p of tables.TASKPRED ?? []) {
    const task = tables.TASK.find((t) => t.task_id === p.task_id);
    const hours = hoursByCalendar.get(task?.clndr_id) ?? 8;
    preds.set(p.task_id, [...(preds.get(p.task_id) ?? []), { id: p.pred_task_id, type: LINK_TYPES[p.pred_type] ?? 'FS', lag_days: round((num(p.lag_hr_cnt) ?? 0) / hours) }]);
  }
  const tasks = tables.TASK.map((t) => {
    const hours = hoursByCalendar.get(t.clndr_id) ?? 8;
    const float = num(t.total_float_hr_cnt);
    const done = t.status_code === 'TK_Complete';
    return baseTask({
      ext_id: t.task_id,
      wbs_code: [wbsCode(t.wbs_id), t.task_code].filter(Boolean).join(' · '),
      name: t.task_name,
      start: isoDay(t.act_start_date || t.restart_date || t.early_start_date || t.target_start_date),
      finish: isoDay(t.act_end_date || t.reend_date || t.early_end_date || t.target_end_date),
      baseline_start: isoDay(t.target_start_date),
      baseline_finish: isoDay(t.target_end_date),
      duration_days: num(t.target_drtn_hr_cnt) === null ? null : round(num(t.target_drtn_hr_cnt) / hours),
      percent_complete: done ? 100 : num(t.phys_complete_pct),
      total_float_days: float === null ? null : round(float / hours),
      float_from_file: float !== null,
      is_critical: done ? false : float !== null ? float <= 0 : null,
      is_milestone: ['TT_Mile', 'TT_FinMile'].includes(t.task_type) ? 1 : 0,
      is_summary: ['TT_WBS', 'TT_LOE'].includes(t.task_type) ? 1 : 0,
      predecessors: preds.get(t.task_id) ?? [],
    });
  });
  const project = tables.PROJECT?.[0];
  return { data_date: isoDay(project?.last_recalc_date || project?.next_data_date), tasks };
}

// ---------- Excel / CSV ----------
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
const COLUMNS = {
  ext_id: ['id', 'n', 'no', 'numero', 'identifiant', 'code', 'task code', 'task id', 'uid'],
  name: ['nom', 'nom de la tache', 'tache', 'libelle', 'designation', 'name', 'task name', 'activite', 'activity name'],
  start: ['debut', 'date de debut', 'start', 'start date', 'debut prevu'],
  finish: ['fin', 'date de fin', 'finish', 'end', 'finish date', 'fin prevue'],
  baseline_start: ['debut de reference', 'debut planifie', 'baseline start', 'debut initial'],
  baseline_finish: ['fin de reference', 'fin planifiee', 'baseline finish', 'fin initiale'],
  duration: ['duree', 'duration', 'duree j', 'duree jours'],
  predecessors: ['predecesseurs', 'predecessors', 'antecedents', 'liens'],
  wbs_code: ['wbs', 'code wbs', 'edt', 'code edt', 'wbs code'],
  percent_complete: ['%', '% acheve', 'avancement', '% complete', 'percent complete', 'pourcentage'],
  total_float_days: ['marge totale', 'marge', 'total float', 'float'],
};

async function parseTable(format, buffer) {
  let rows;
  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => rows.push((row.values ?? []).slice(1).map((v) => (v && typeof v === 'object' && !(v instanceof Date) ? (v.result ?? v.text ?? '') : v))));
  } else {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    const sep = (text.split('\n')[0].match(/;/g) ?? []).length >= (text.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
    rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => splitCsv(l, sep));
  }
  const headerIndex = rows.findIndex((r) => r.some((c) => COLUMNS.name.includes(norm(c))));
  if (headerIndex < 0) throw new Error('En-têtes introuvables : la première ligne doit contenir au moins « Nom » (ou « Tâche »), « Début » et « Fin ».');
  const header = rows[headerIndex].map(norm);
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, header.findIndex((h) => names.includes(h))]));
  const get = (r, k) => (col[k] >= 0 ? r[col[k]] : null);
  const tasks = rows.slice(headerIndex + 1).map((r, i) => {
    const start = isoDay(get(r, 'start'));
    let finish = isoDay(get(r, 'finish'));
    const duration = num(get(r, 'duration'));
    if (!finish && start && duration !== null) finish = new Date(toMs(start) + Math.max(duration - 1, 0) * DAY).toISOString().slice(0, 10);
    const float = num(get(r, 'total_float_days'));
    return baseTask({
      ext_id: String(get(r, 'ext_id') ?? i + 1),
      name: String(get(r, 'name') ?? '').trim(),
      wbs_code: get(r, 'wbs_code') ? String(get(r, 'wbs_code')) : null,
      start,
      finish,
      baseline_start: isoDay(get(r, 'baseline_start')),
      baseline_finish: isoDay(get(r, 'baseline_finish')),
      duration_days: duration,
      percent_complete: num(get(r, 'percent_complete')),
      total_float_days: float,
      float_from_file: float !== null,
      is_milestone: duration === 0 || (start && start === finish && duration === null) ? 1 : 0,
      predecessors: parsePredecessors(get(r, 'predecessors')),
    });
  });
  return { data_date: null, tasks: tasks.filter((t) => t.name) };
}

function splitCsv(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** « 3;5FS+2j;7DD-1 » → liens. Accepte les abréviations françaises (FD, DD, FF, DF). */
export function parsePredecessors(value) {
  if (value === null || value === undefined || value === '') return [];
  return String(value)
    .split(/[;,]/)
    .map((p) => p.trim().match(/^([A-Za-z0-9._-]*?\d[A-Za-z0-9._-]*?)\s*(FS|FD|SS|DD|FF|SF|DF)?\s*([+-]\s*\d+(?:[.,]\d+)?)?\s*(j|jours?|d|days?|jo)?$/i))
    .filter(Boolean)
    .map((m) => ({ id: m[1], type: LINK_TYPES[(m[2] ?? 'FS').toUpperCase()], lag_days: m[3] ? Number(m[3].replace(/\s/g, '').replace(',', '.')) : 0 }));
}

/**
 * Marge totale par passe arrière sur les dates du planning (jours calendaires) :
 * les dates du fichier servent de dates au plus tôt, la date de fin la plus tardive borne le projet.
 */
export function computeFloat(tasks) {
  const byId = new Map(tasks.map((t) => [t.ext_id, t]));
  const successors = new Map(tasks.map((t) => [t.ext_id, []]));
  for (const t of tasks) for (const p of t.predecessors) if (byId.has(p.id)) successors.get(p.id).push({ task: t, type: p.type, lag: p.lag_days ?? 0 });

  // Une tâche occupe les jours [début, fin + 1[. Un jalon est un instant sans durée :
  // en fin de journée s'il suit d'autres tâches (jalon de fin), sinon en début de journée.
  const point = (t) => toMs(t.finish) / DAY + (t.predecessors.some((p) => byId.has(p.id)) ? 1 : 0);
  const ef = (t) => (t.is_milestone ? point(t) : toMs(t.finish) / DAY + 1);
  const es = (t) => (t.is_milestone ? point(t) : toMs(t.start) / DAY);
  const dur = (t) => ef(t) - es(t);
  const projectEnd = Math.max(...tasks.map(ef));
  const lf = new Map();
  const visiting = new Set();

  const lateFinish = (t) => {
    if (lf.has(t.ext_id)) return lf.get(t.ext_id);
    if (visiting.has(t.ext_id)) return projectEnd; // boucle de liens : on l'ignore
    visiting.add(t.ext_id);
    let value = projectEnd;
    for (const s of successors.get(t.ext_id)) {
      const sLf = lateFinish(s.task);
      const sLs = sLf - dur(s.task);
      const bound = { FS: sLs - s.lag, SS: sLs - s.lag + dur(t), FF: sLf - s.lag, SF: sLf - s.lag + dur(t) }[s.type];
      value = Math.min(value, bound);
    }
    visiting.delete(t.ext_id);
    lf.set(t.ext_id, value);
    return value;
  };

  for (const t of tasks) {
    if (t.total_float_days !== null) continue;
    t.total_float_days = round(lateFinish(t) - ef(t));
    t.is_critical = null;
  }
}

const round = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

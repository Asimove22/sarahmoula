import { getLang } from './i18n';

export type Rec = Record<string, any>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // La langue est transmise au serveur pour les points d'attention, échéances et messages d'erreur.
  const headers = new Headers(init?.headers);
  headers.set('X-Lang', getLang());
  const res = await fetch(path, { ...init, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error((isJson && data?.error) || `Erreur ${res.status}`);
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  get: <T = Rec[]>(path: string) => request<T>(path),
  post: <T = Rec>(path: string, body: unknown) => request<T>(path, json('POST', body)),
  put: <T = Rec>(path: string, body: unknown) => request<T>(path, json('PUT', body)),
  del: (path: string) => request<Rec>(path, { method: 'DELETE' }),
  upload: <T = Rec[]>(path: string, files: File[], fields: Rec = {}) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    for (const f of files) form.append('files', f, f.name);
    return request<T>(path, { method: 'POST', body: form });
  },
};

export const fileUrl = (doc: Rec, download = false) => `/api/documents/${doc.id}/file${download ? '?download=1' : ''}`;

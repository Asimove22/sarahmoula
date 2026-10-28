import { Fragment, createContext, useContext, useState, type ReactNode } from 'react';
import { EN } from './en';

export type Lang = 'fr' | 'en';
const KEY = 'clausia.lang';

function storedLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

let current: Lang = storedLang();
export const getLang = () => current;

/**
 * Traduction : la clé est le texte français. Sans traduction anglaise connue, le français s'affiche.
 * Paramètres : t('{n} contrat(s)', { n: 3 }).
 */
export function t(fr: string, params?: Record<string, string | number | null | undefined>): string {
  let s = current === 'en' ? (EN[fr] ?? fr) : fr;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v ?? ''));
  return s;
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });
export const useLang = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current);
  const setLang = (l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // stockage indisponible : la langue vaut pour la session
    }
    document.documentElement.lang = l;
    setState(l);
  };
  // La clé force le re-rendu complet de l'application dans la nouvelle langue.
  return (
    <Ctx.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </Ctx.Provider>
  );
}

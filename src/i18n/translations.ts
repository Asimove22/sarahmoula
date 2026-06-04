export type Lang = 'fr' | 'it'

export const translations = {
  fr: {
    nav: {
      apropos: 'À propos',
      services: 'Services',
      opportunites: 'Opportunités',
      contact: 'Contact',
      cta: 'Rejoindre DzBridge',
      phase: 'Phase 1 · En cours',
    },
    hero: {
      badge: 'Plateforme Numérique de la Diaspora Algérienne · 2026',
      headline1: 'La passerelle de la',
      headline2: 'diaspora algérienne',
      headline3: 'vers',
      headline4: "l'Algérie de demain",
      subtitle: 'DzBridge connecte investisseurs diaspora et porteurs de projets algériens. Investissement · Compétences · Incubation · Communauté.',
      cta_primary: 'Rejoindre la plateforme',
      cta_secondary: 'Découvrir le projet',
      countries: ['France 2,5M', 'Canada 350K', 'Allemagne 200K', 'Royaume-Uni 180K', 'Émirats 150K'],
      stats: [
        { value: '4,2M', label: "Algériens à l'étranger" },
        { value: '€2,1B', label: 'Transferts annuels' },
        { value: '60%', label: 'Souhaitent investir' },
        { value: '€850M', label: 'Marché adressable' },
      ],
    },
    footer: {
      tagline: 'La passerelle de la diaspora algérienne',
      description:
        'Connecter investisseurs diaspora et porteurs de projets algériens. Investissement · Compétences · Incubation · Communauté.',
      nav_title: 'Plateforme',
      nav_links: ['À propos', 'Services', 'Opportunités', 'Roadmap', 'Équipe', 'Contact'],
      contact_title: 'Contact',
      rights: '© 2026 DzBridge. Document confidentiel — Ne pas diffuser sans autorisation.',
      phase: 'Phase 1 · En cours',
      seed: 'Levée seed · €500K · 2026',
      social_label: 'Nous suivre',
    },
  },
  it: {
    nav: {
      apropos: 'Chi siamo',
      services: 'Servizi',
      opportunites: 'Opportunità',
      contact: 'Contatti',
      cta: 'Unisciti a DzBridge',
      phase: 'Fase 1 · In corso',
    },
    hero: {
      badge: 'Piattaforma di Investimento in Algeria · 2026',
      headline1: 'Il ponte verso le',
      headline2: 'opportunità algerine',
      headline3: 'per gli investitori',
      headline4: 'internazionali',
      subtitle:
        "DzBridge connette investitori internazionali con progetti algerini verificati. Investimento · Competenze · Incubazione · Comunità.",
      cta_primary: 'Unisciti alla piattaforma',
      cta_secondary: 'Scopri il progetto',
      countries: ['Francia 2,5M', 'Canada 350K', 'Germania 200K', 'Regno Unito 180K', 'Emirati 150K'],
      stats: [
        { value: '4,2M', label: "Algerini all'estero" },
        { value: '€2,1B', label: 'Trasferimenti annui' },
        { value: '60%', label: 'Vogliono investire' },
        { value: '€850M', label: 'Mercato indirizzabile' },
      ],
    },
    footer: {
      tagline: "Il ponte verso l'Algeria di domani",
      description:
        'Colleghiamo investitori internazionali con imprenditori algerini verificati. Investimento · Competenze · Incubazione · Comunità.',
      nav_title: 'Piattaforma',
      nav_links: ['Chi siamo', 'Servizi', 'Opportunità', 'Roadmap', 'Team', 'Contatti'],
      contact_title: 'Contatti',
      rights: '© 2026 DzBridge. Documento riservato — Non distribuire senza autorizzazione.',
      phase: 'Fase 1 · In corso',
      seed: 'Seed round · €500K · 2026',
      social_label: 'Seguici',
    },
  },
} as const

export type Translations = typeof translations.fr

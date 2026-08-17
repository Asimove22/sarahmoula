---
name: ui-ux-pro-max-guide
description: Guide pour installer et utiliser UI/UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill) — un skill Claude Code qui fournit une intelligence de design pour produire des interfaces dignes d'un designer senior : bases de données de styles UI (glassmorphism, neumorphism, bento grid...), palettes de couleurs, associations de polices, guidelines UX/accessibilité, et génération de systèmes de design complets adaptés à 22 stacks techniques (React, Next.js, Vue, Tailwind, shadcn/ui...). Utilise ce skill dès que l'utilisateur veut installer ou configurer UI/UX Pro Max, ou plus largement quand il demande une interface, un design, une landing page, un dashboard ou un système de design de qualité professionnelle et que ce skill n'est pas encore installé dans le projet.
---

# UI/UX Pro Max

UI/UX Pro Max (dépôt GitHub `nextlevelbuilder/ui-ux-pro-max-skill`) est un skill Claude Code qui apporte une intelligence de design : bases de données de 79 styles UI, 192 palettes de couleurs alignées par type de produit, 74 associations de polices, 119 guidelines UX/accessibilité, et un générateur de système de design complet couvrant 22 stacks techniques.

Contrairement à `ollama` ou `claude-mem`, UI/UX Pro Max **est lui-même un skill Claude Code packagé** — l'installer revient à ajouter un dossier `.claude/skills/ui-ux-pro-max/` complet (données + scripts de recherche) au projet, pas seulement un outil externe à documenter. Ce skill-ci sert de guide pour réaliser cette installation correctement.

## 1. Vérifier les prérequis

```bash
python3 --version   # requis pour les scripts de recherche (stdlib uniquement, aucune dépendance)
node --version       # requis pour l'installeur CLI npm
```

Python doit être installé manuellement par l'utilisateur si absent (aucun agent IA ne peut l'installer à sa place sur toutes les plateformes).

## 2. Installer

**Via le CLI npm (recommandé)** :
```bash
npm install -g ui-ux-pro-max-cli
cd /chemin/vers/le/projet
uipro init --ai claude
```

**Installation globale** (disponible dans tous les projets, placé dans `~/.claude/skills/`) :
```bash
uipro init --ai claude --global
```

**Via le marketplace de plugins Claude Code** (alternative) :
```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

D'autres cibles existent pour `--ai` (`cursor`, `windsurf`) si l'utilisateur travaille avec un autre outil que Claude Code.

Ne pas essayer d'uploader le dépôt complet dans Claude.ai — il dépasse la limite de 200 fichiers pour un upload manuel. Toujours passer par le CLI.

## 3. Utilisation une fois installé

Le skill s'active automatiquement dans Claude Code dès qu'une demande de design/UI est formulée — pas besoin de l'invoquer explicitement. Exemples de demandes qui le déclenchent :
- "Construis une landing page pour mon produit SaaS"
- "Crée un dashboard pour de l'analytics santé"
- "Dessine un portfolio avec un mode sombre"

**Accès avancé en ligne de commande**, une fois le skill installé dans le projet :
```bash
# Générer un système de design complet avec sortie ASCII
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness" \
  --design-system -p "Serenity Spa"

# Recherche ciblée par domaine
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard" --domain chart

# Système de design persistant (écrit sur disque)
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "SaaS dashboard" \
  --design-system --persist -p "MyApp"
```
La version persistante crée `design-system/MASTER.md` ainsi que des surcharges par page dans `design-system/pages/`.

## 4. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Unknown command 'uninstall'` | CLI obsolète | `npm install -g ui-ux-pro-max-cli@latest` |
| `No installed AI skill directories detected` | Commande lancée hors du dossier projet où le skill a été installé | Relancer depuis la racine du projet d'origine, ou utiliser `uipro uninstall --global` si l'installation était globale |
| `python3: command not found` | Python non installé | Installer Python 3.x via python.org ou le gestionnaire de paquets de l'OS (pas d'installation automatique possible) |
| Le skill ne se déclenche jamais sur des demandes de design | Installation locale au mauvais projet, ou installation globale absente | Vérifier la présence de `.claude/skills/ui-ux-pro-max/` dans le projet courant, ou réinstaller avec `--global` |

Pour un problème non couvert ici, consulter les issues du dépôt : https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/issues

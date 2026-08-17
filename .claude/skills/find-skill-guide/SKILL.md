---
name: find-skill-guide
description: Guide pour installer et utiliser Find Skill (fockus/claude-skill-find-skill) — un méta-skill/CLI qui recherche parmi plus de 4800 skills issus de 14 sources communautaires et officielles, puis les installe automatiquement pour Claude Code (ou Codex, OpenCode, Cursor), avec conversion de format automatique. Utilise ce skill dès que l'utilisateur veut installer ou configurer Find Skill, ou plus largement quand il veut découvrir/rechercher un skill existant sur un sujet donné et se le faire installer automatiquement plutôt que d'en écrire un lui-même.
---

# Find Skill

Find Skill (dépôt GitHub `fockus/claude-skill-find-skill`) est un méta-skill dont le rôle est de trouver et d'installer d'autres skills à la place de l'utilisateur. Il interroge un catalogue local (4835 skills, ~2,5 Mo, sans connexion nécessaire pour la recherche de base) et bascule vers l'API SkillsMP en ligne quand les résultats locaux sont insuffisants. Une fois un skill trouvé, il gère la conversion de format et le dépôt dans le bon dossier pour l'agent cible (Claude Code, Codex, OpenCode ou Cursor).

**Point d'attention à transmettre à l'utilisateur** : ce méta-skill télécharge et installe des fichiers `SKILL.md` (et parfois des scripts associés) provenant de dépôts tiers non vérifiés par Anthropic. Un skill installé peut contenir des instructions arbitraires exécutées lors de son déclenchement. Recommander à l'utilisateur de jeter un œil au contenu d'un skill avant de l'utiliser en confiance, surtout s'il touche à des données sensibles ou exécute des scripts.

## 1. Installer Find Skill lui-même

Trois méthodes équivalentes, à choisir selon l'environnement :

**Homebrew (macOS/Linux)** :
```bash
brew tap fockus/tap
brew install find-skill
find-skill
```

**pipx** :
```bash
pipx install find-skill
find-skill
```

**One-liner curl** :
```bash
curl -sSL https://raw.githubusercontent.com/fockus/claude-skill-find-skill/main/quick-install.sh | bash
```

Toutes ces méthodes rendent disponibles les commandes `/find-skill` et `/install-skill` directement dans l'agent IA (Claude Code, etc.), en plus du CLI `find-skill` autonome en ligne de commande.

## 2. Rechercher un skill

```bash
# Recherche dans le catalogue local (rapide, hors ligne)
/find-skill docker

# Étendre la recherche à tous les agents supportés, pas seulement Claude
/find-skill docker --agent any
```

La recherche locale interroge d'abord le catalogue embarqué et classe les résultats par priorité de source puis par nombre d'étoiles GitHub ; elle ne tape l'API en ligne que si les résultats locaux sont trop maigres.

## 3. Installer un skill trouvé

```bash
# Déployer un skill précis vers l'agent courant
/install-skill owner/repo

# Déployer vers les quatre agents supportés simultanément
find-skill --target all

# Déployer uniquement pour Claude Code
find-skill --target claude
```

La conversion de format entre agents est automatique — un skill écrit pour Cursor par exemple peut être adapté au format attendu par Claude Code sans intervention manuelle.

## 4. Maintenir le catalogue à jour

```bash
find-skill update
```

Rafraîchit le catalogue local — utile si un skill récemment publié n'apparaît pas dans les résultats de recherche.

## 5. Configuration optionnelle (API SkillsMP)

Une clé API SkillsMP donne accès à 352 skills supplémentaires du marketplace et active le fallback vers des requêtes live. Elle se stocke dans :
```bash
~/.claude/skills/find-skill/.env
chmod 600 ~/.claude/skills/find-skill/.env
```
Cette clé n'est jamais commitée ni partagée automatiquement — vérifier tout de même que ce fichier `.env` reste hors d'un dépôt git versionné (ajouter `.env` au `.gitignore` du projet si le dossier `~/.claude/skills/` venait à être suivi par erreur).

## 6. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Aucun résultat pertinent en recherche locale | Skill trop récent, absent du catalogue embarqué | Lancer `find-skill update` puis relancer la recherche ; sinon la recherche bascule normalement vers l'API live |
| `/install-skill owner/repo` échoue | Dépôt introuvable, privé, ou sans `SKILL.md` à la racine attendue | Vérifier l'URL exacte du dépôt et la présence d'un `SKILL.md` valide |
| Clé API SkillsMP non prise en compte | Mauvais chemin ou permissions du fichier `.env` | Vérifier `~/.claude/skills/find-skill/.env` et ses permissions (`chmod 600`) |
| Skill installé mais qui ne se déclenche jamais | Conversion de format incomplète pour l'agent cible | Relire le `SKILL.md` installé pour vérifier que son frontmatter (`name`, `description`) est bien formé pour Claude Code |

Pour un problème non couvert ici, consulter les issues du dépôt : https://github.com/fockus/claude-skill-find-skill/issues

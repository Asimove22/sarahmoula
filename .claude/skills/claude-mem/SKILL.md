---
name: claude-mem
description: Guide pour installer, configurer et utiliser claude-mem (thedotmack/claude-mem) — un plugin de mémoire persistante pour Claude Code qui capture ce qui se passe pendant une session, le compresse avec un modèle IA, et réinjecte le contexte pertinent dans les sessions futures, pour que Claude se souvienne du projet d'une conversation à l'autre au lieu de repartir de zéro à chaque fois. Utilise ce skill dès que l'utilisateur mentionne claude-mem, veut que Claude "se souvienne" ou garde le contexte entre plusieurs sessions/conversations, demande une mémoire persistante, un historique de session, ou se plaint de devoir tout réexpliquer à chaque nouvelle conversation.
---

# claude-mem

`claude-mem` (dépôt GitHub `thedotmack/claude-mem`, licence Apache 2.0) est un plugin qui donne à Claude Code une mémoire persistante entre sessions. Sans lui, chaque nouvelle conversation Claude Code repart de zéro — `claude-mem` capture ce qui se passe pendant une session, le résume, et réinjecte automatiquement le contexte pertinent au démarrage des sessions suivantes.

Ce skill sert de référence pour installer, configurer et dépanner cet outil. Vérifie toujours l'état réel de l'environnement avant d'agir plutôt que de supposer que quelque chose est déjà en place.

## Fonctionnement

Le plugin s'accroche à cinq événements du cycle de vie de Claude Code : `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`, `SessionEnd`. Un service worker (basé sur Bun) tourne en arrière-plan et gère une base SQLite qui stocke les sessions et les observations. Les résumés sont générés sémantiquement et récupérés via une base vectorielle (Chroma) pour une recherche hybride — Claude peut ainsi retrouver le contexte pertinent d'une session passée sans avoir à tout relire.

## 1. Vérifier les prérequis

```bash
node --version    # >= 20.0.0 requis
bun --version      # installé automatiquement si absent
```

`claude-mem` nécessite Claude Code avec support des plugins. Vérifie que la version de Claude Code installée le supporte avant de continuer.

## 2. Installer

Installation la plus simple (recommandée) :
```bash
npx claude-mem install
```

Variantes selon l'environnement cible :
```bash
# Pour OpenCode au lieu de Claude Code
npx claude-mem install --ide opencode

# Pour Antigravity CLI
npx claude-mem install --ide antigravity

# Via le marketplace de plugins Claude Code (alternative)
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem

# Pour les passerelles OpenClaw
curl -fsSL https://install.cmem.ai/openclaw.sh | bash
```

`claude-mem` fonctionne aussi avec Codex, Gemini, Copilot et d'autres agents — utile si l'utilisateur travaille avec plusieurs outils IA et veut une mémoire partagée.

## 3. Configuration

Les réglages vivent dans `~/.claude-mem/settings.json`, créé automatiquement à la première installation. On y configure notamment :
- le modèle IA utilisé pour compresser/résumer les observations,
- le port du service worker,
- le comportement d'injection de contexte (quand et combien de contexte est réinjecté).

Vérifier ce fichier avant de modifier la configuration à la main :
```bash
cat ~/.claude-mem/settings.json
```

## 4. Utiliser au quotidien

- **Capture automatique** : une fois installé, aucune action requise — chaque session est automatiquement observée et résumée en arrière-plan.
- **Recherche en langage naturel** : le skill intégré `mem-search` permet à Claude de retrouver des informations de sessions passées par une requête en langage naturel plutôt qu'en parcourant des logs bruts.
- **Confidentialité** : entourer un passage de balises `<private>...</private>` pendant une session empêche qu'il soit capturé et persisté.
- **Interface web** : une UI de visualisation en temps réel du flux de mémoire est disponible — utile pour inspecter ce qui a été retenu.
- **Coût en tokens** : le système affiche le coût en tokens de l'injection de contexte (progressive disclosure) — surveille-le si le contexte réinjecté semble trop volumineux et ralentit les réponses.

## 5. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `npx claude-mem install` échoue avec une erreur Node | Version de Node trop ancienne | Vérifier `node --version` ; installer Node 20+ |
| Le contexte des sessions précédentes n'apparaît jamais | Le worker ne tourne pas, ou le plugin n'est pas activé dans la session courante | Vérifier que le plugin est bien installé (`/plugin` dans Claude Code) et que le service worker Bun tourne |
| Informations sensibles capturées par erreur | Pas de balise `<private>` utilisée au moment de les partager | Utiliser `<private>...</private>` autour du contenu sensible à l'avenir ; supprimer manuellement l'entrée correspondante dans la base SQLite si nécessaire |
| Le contexte réinjecté est énorme et ralentit les réponses | Trop d'historique jugé "pertinent" est réinjecté | Ajuster le comportement d'injection de contexte dans `~/.claude-mem/settings.json` |
| Conflit de port au démarrage du worker | Un autre processus utilise déjà le port configuré | Changer le port du worker dans `~/.claude-mem/settings.json` |

Pour un problème non couvert ici, consulter les issues du dépôt : https://github.com/thedotmack/claude-mem/issues

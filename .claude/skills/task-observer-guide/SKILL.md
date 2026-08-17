---
name: task-observer-guide
description: Guide pour installer et utiliser Task Observer / "One Skill to Rule Them All" (rebelytics/one-skill-to-rule-them-all) — un méta-skill Claude Code qui observe les sessions de travail, repère les corrections et les patterns récurrents, et propose des améliorations de skills (y compris de lui-même) lors d'une revue périodique. Utilise ce skill dès que l'utilisateur veut installer ou configurer Task Observer, ou plus largement quand il demande que sa configuration Claude Code "s'améliore toute seule", que les skills soient affinés automatiquement au fil de l'usage, ou une revue récurrente de ce qui a bien/mal fonctionné dans les sessions passées.
---

# Task Observer

Task Observer (dépôt GitHub `rebelytics/one-skill-to-rule-them-all`, aussi appelé "One Skill to Rule Them All") est un méta-skill : un skill dont le rôle est d'observer les sessions de travail et d'améliorer les *autres* skills — et de s'améliorer lui-même — au fil du temps, en captant les corrections que l'utilisateur fait et les patterns qui se répètent.

**Point important à ne pas survendre à l'utilisateur** : contrairement à ce que le nom laisse penser, le skill ne modifie **pas** les fichiers de skills automatiquement et silencieusement. Il produit des logs d'observations structurés, et c'est l'utilisateur qui relit et approuve les changements lors d'une revue périodique. "S'améliore toute seule" décrit le cycle d'observation → suggestion, pas une réécriture de config sans supervision.

## 1. Installer

Il n'y a pas d'installeur CLI pour ce skill — l'installation est un simple ajout de fichiers, comme pour n'importe quel skill Claude Code.

**Sur Claude Code (desktop/CLI)** :
```bash
git clone https://github.com/rebelytics/one-skill-to-rule-them-all.git /tmp/task-observer-src
mkdir -p .claude/skills/task-observer
cp -r /tmp/task-observer-src/SKILL.md /tmp/task-observer-src/references .claude/skills/task-observer/
rm -rf /tmp/task-observer-src
```
Adapter le chemin de destination selon qu'on veut un skill par projet (`.claude/skills/`) ou global (`~/.claude/skills/`).

**Sur Claude.ai (web/mobile)** : télécharger le `SKILL.md` et le dossier `references/` du dépôt, les compresser en `.zip`, puis les téléverser via Réglages → Capacités (Settings → Capabilities).

## 2. Comment il fonctionne

Pendant une session de travail multi-étapes (utilisation d'outils, production de livrables), le skill repère :
- les corrections que l'utilisateur apporte à ce que Claude propose,
- les workflows répétés plusieurs fois,
- les techniques qui ont particulièrement bien fonctionné.

Il consigne ces observations sous forme d'entrées numérotées dans `skill-observations/log.md`, avec le skill concerné et l'amélioration suggérée — sans toucher aux fichiers de skills eux-mêmes à ce stade.

## 3. Le cycle de revue

Une revue (« Weekly Review ») est déclenchée quand `skill-observations/last-review-date.txt` indique une date de plus de 7 jours, ou est absent. Elle peut aussi être déclenchée manuellement, ou immédiatement si un skill produit une sortie visiblement incorrecte en pleine session.

Lors de cette revue, l'utilisateur passe en revue les observations accumulées dans `log.md` et **valide** les améliorations à appliquer — le skill les rédige mais ne les applique jamais sans cette validation.

### Automatiser le déclenchement de la revue hebdomadaire

Le skill lui-même ne se réveille pas tout seul un jour donné — il vérifie l'âge de `last-review-date.txt` seulement quand une session tourne. Pour obtenir une vraie cadence hebdomadaire sans y penser, il faut programmer une tâche récurrente qui invoque la revue (ex. via un outil de planification/cron de l'environnement Claude Code utilisé, s'il y en a un). Proposer cette automatisation à l'utilisateur plutôt que la mettre en place sans le lui demander explicitement, car cela crée une tâche planifiée persistante sur son compte.

## 4. Précautions

- Le skill lit et écrit des fichiers dans le dossier `skill-observations/` du projet ou du dossier partagé (selon l'environnement) — vérifier qu'aucune information sensible ne s'y retrouve si ce dossier est partagé ou versionné.
- Toujours relire les suggestions avant de les appliquer : le skill formalise des patterns observés, il ne garantit pas qu'ils soient réellement souhaitables à généraliser.
- Sur Claude Cowork, les observations sont écrites dans un dossier partagé (`[dossier partagé]/skill-observations/`) — visible par les autres personnes ayant accès à ce dossier.

## 5. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le skill ne semble jamais proposer de revue | `last-review-date.txt` absent ou session trop courte pour accumuler des observations | Vérifier la présence de `skill-observations/log.md` ; demander explicitement une revue |
| Les fichiers `references/` manquent après installation manuelle | Copie incomplète du dépôt | Revérifier que tout `references/` a bien été copié à côté de `SKILL.md`, pas seulement ce dernier |
| Trop d'observations non pertinentes accumulées | Utilisation sur des sessions très courtes ou hors contexte de travail répétitif | Ignorer les entrées non pertinentes lors de la revue ; le skill n'exige pas de traiter chaque ligne |

Pour un problème non couvert ici, consulter le dépôt : https://github.com/rebelytics/one-skill-to-rule-them-all

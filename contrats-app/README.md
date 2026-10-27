# Gestion contractuelle et documentaire

Application **personnelle et locale** pour gérer le cycle de vie de tes contrats (NEC3/NEC4 et contrats de droit français) :

- **Contrats** : fiche complète (parties, montant, dates, préavis, reconduction tacite, intervenants, délais NEC).
- **GED** : dépôt par glisser-déposer des contrats, annexes, avenants, plannings, PV… avec **versions** (v1, v2…), empreinte SHA-256 et corbeille (rien n'est effacé).
- **Early Warnings** (NEC cl. 15) : registre, effets potentiels, gravité, prochaine revue, conversion en Compensation Event en un clic.
- **Compensation Events** (NEC cl. 60 à 65) : calcul automatique des délais (notification sous 8 sem., réponse PM 1 sem., devis 3 sem., réponse au devis 2 sem.) et **alerte de forclusion**.
- **Échanges** : dépôt d'emails Outlook `.msg`, `.eml` ou de courriers PDF. L'objet, l'expéditeur, la date, le texte et les pièces jointes sont lus et archivés automatiquement. Suivi des réponses attendues.
- **Planning** : jalons, Key Dates, Completion, frise avec glissements prévus / réels.
- **Tableau de bord et échéancier** : retards, échéances à 30 jours, calendrier mensuel, **export vers Outlook / Google Agenda** (`.ics` avec rappel 3 jours avant).
- **Recherche globale**, **historique** de toutes les actions, **exports Excel** (CSV) de chaque registre.

Tout reste sur ton PC : l'application n'écoute que `localhost` et n'envoie rien sur Internet.

---

## Installation pas à pas (Windows)

### Étape 1 : installer Node.js (une seule fois)

1. Va sur <https://nodejs.org/fr/download> et télécharge la version **LTS** (22 ou plus récente).
2. Lance l'installeur et clique sur « Suivant » jusqu'à la fin (options par défaut).
3. Vérification : ouvre l'invite de commandes (touche Windows, tape `cmd`) puis tape `node -v`. Tu dois voir `v22.x.x` ou plus.

### Étape 2 : récupérer l'application

- **Avec Git** : `git clone https://github.com/asimove22/sarahmoula.git`, puis ouvre le dossier `sarahmoula\contrats-app`.
- **Sans Git** : sur GitHub, bouton **Code → Download ZIP**, décompresse-le par exemple dans `C:\Contrats\`, puis ouvre le dossier `contrats-app`.

> Évite de placer le dossier dans OneDrive ou Dropbox : la synchronisation peut corrompre la base pendant son utilisation. Pour la sauvegarde, utilise plutôt l'étape 5.

### Étape 3 : lancer l'application

Double-clique sur **`Lancer.bat`**.

- Le premier lancement télécharge les composants (1 à 2 minutes, connexion Internet nécessaire).
- Le navigateur s'ouvre ensuite sur <http://localhost:4580>.
- **Laisse la fenêtre noire ouverte** pendant que tu utilises l'application. La fermer arrête l'application.

Astuce : clic droit sur `Lancer.bat` → *Envoyer vers* → *Bureau (créer un raccourci)*.

### Étape 4 : premier contrat

1. **Contrats → Nouveau contrat** : renseigne au minimum l'intitulé et le cadre (NEC4, NEC3, marché public…). Pour un contrat NEC, vérifie les délais dans la section « Délais NEC » : s'ils diffèrent dans ton Contract Data, modifie-les ici, tous les calculs suivront.
2. Tu arrives sur l'onglet **Documents** : choisis la catégorie (Contrat, Annexe, Avenant…) puis glisse tes fichiers.
3. Pour remplacer un document par une version plus récente, utilise l'icône **« Déposer une nouvelle version »** sur sa ligne. L'ancienne version reste consultable via l'historique.
4. **Échanges** : glisse directement tes emails depuis Outlook (enregistre-les d'abord en `.msg` par glisser-déposer vers le Bureau) ou tes PDF. Coche « Réponse attendue » et indique la date limite pour être alerté.
5. **Early Warnings** : « Notifier un Early Warning », renseigne les effets et la prochaine revue. Quand le risque devient un événement indemnisable, ouvre-le et clique **« Convertir en Compensation Event »**.
6. **Compensation Events** : saisis la date de connaissance de l'événement, la date de notification, puis les dates de devis. Les échéances se calculent seules. Une ligne rouge signale un risque de forclusion.
7. **Planning** : ajoute les Key Dates, la Completion, les soumissions de programme… Renseigne la date prévisionnelle pour visualiser les glissements.

### Étape 5 : sauvegarder

Double-clique sur **`Sauvegarder.bat`** (de préférence application fermée). Il crée un fichier `sauvegardes\sauvegarde-AAAAMMJJ-HHMM.zip` contenant la base **et** tous les documents. Copie-le régulièrement sur une clé USB ou un disque externe.

**Restaurer** : application fermée, supprime (ou renomme) le dossier `data`, puis décompresse le zip dans `contrats-app` (on doit retrouver `contrats-app\data\contrats.db`).

### Étape 6 : brancher l'agenda

Bouton **« Exporter vers mon agenda »** (tableau de bord) ou **« Agenda »** (fiche contrat), puis ouvre le fichier `.ics` téléchargé : Outlook propose de l'importer. Pour Google Agenda : *Paramètres → Importer et exporter*. Refais l'export quand de nouvelles échéances apparaissent.

---

## Où sont mes données ?

| Élément | Emplacement |
|---|---|
| Base de données | `contrats-app\data\contrats.db` (SQLite) |
| Documents | `contrats-app\data\files\<n° du contrat>\` |
| Fichiers supprimés | `contrats-app\data\corbeille\` |
| Sauvegardes | `contrats-app\sauvegardes\` |

Pour placer les données ailleurs (par exemple sur un disque D:), crée un fichier `Lancer-D.bat` avec la ligne `set DATA_DIR=D:\MesContrats` avant `node …`, ou définis la variable d'environnement `DATA_DIR`.

## Mettre à jour l'application

Remplace les fichiers de l'application **sans toucher au dossier `data`** (avec Git : `git pull`), puis relance `Lancer.bat`. Si de nouveaux composants ont été ajoutés, supprime le dossier `node_modules` avant de relancer. Fais une sauvegarde avant chaque mise à jour.

## Règles de calcul des échéances

| Échéance | Règle |
|---|---|
| Date limite de préavis / dénonciation | Date de fin moins le préavis (jours) |
| Notification d'un CE par l'Entrepreneur | Date de connaissance + 8 sem. (cl. 61.3, forclusion) |
| Réponse du PM à la notification | Date de notification + 1 sem. (cl. 61.4) |
| Remise du devis | Date de demande + 3 sem. (cl. 62.3) |
| Réponse du PM au devis | Date de remise + 2 sem. (cl. 62.3) |
| Revue d'un Early Warning | Date « prochaine revue » tant que l'EW est ouvert |
| Réponse à un courrier | Date « répondre avant le » tant que « répondu le » est vide |
| Jalon | Date prévisionnelle, sinon date prévue, tant que la date réelle est vide |

Les durées NEC sont modifiables contrat par contrat. Les contrats « brouillon », « clôturé », « résilié » ou « archivé » ne génèrent pas d'alerte.

## Pour le développement

```bash
npm install
npm run dev:server   # API sur http://localhost:4580 (rechargement auto)
npm run dev          # interface Vite avec rechargement à chaud
npm test             # tests de l'API
npm run typecheck    # vérification TypeScript
```

Architecture : serveur Express (`server/`), base SQLite intégrée à Node (`node:sqlite`, aucune compilation native), interface React + Tailwind (`src/`) construite dans `dist/` et servie par le même serveur.

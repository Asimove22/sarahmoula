# Gestion contractuelle et documentaire

Application **personnelle et locale** pour gérer le cycle de vie de tes contrats (NEC3/NEC4 et contrats de droit français) :

- **Contrats** : fiche complète (parties, montant, dates, préavis, reconduction tacite, réception, conditions financières, délais NEC et de visa).
- **GED** : dépôt par glisser-déposer du contrat, de l'acte d'engagement, CCAP, CCTP, CCAG Travaux, Contract Data, annexes, avenants, convention de groupement, BPU/DQE/DPGF, WBS, RACI, matrice de communication, revue de contrat… avec **versions**, empreinte SHA-256 et corbeille. **Recherche plein texte** dans le contenu des PDF, Word, Excel et emails (insensible aux accents).
- **Revue de contrat** : check-list type par cadre (commune, NEC, CCAG Travaux, NF P03-001) et **analyse IA des pièces** (clauses à risque, dates clés, obligations à délai) à valider point par point.
- **Organisation** : intervenants, **groupement** (mandataire, quotes-parts, contrôle des 100 %), **matrice RACI** éditable (contrôle « un seul A »), **matrice de communication** qui propose le destinataire des courriers.
- **Planning** : jalons ; **import MS Project (XML), Primavera P6 (XER), Excel et CSV** ; **chemin critique** et marges (lues dans le fichier ou calculées) ; Gantt ; comparaison de deux versions de planning ; WBS créée depuis le planning ; **programmes NEC** (réponse du PM cl. 31.3, prochain programme révisé cl. 32.2).
- **Circuit de visa** : documents transmis, délai de visa, avis VSO / VAO / refusé, indices successifs.
- **Finances** : avenants, situations de travaux, montant actualisé (initial + avenants + CE), facturé, payé, retenue de garantie, retards de paiement.
- **Courriers Word pré-remplis** : notification d'EW et de CE, devis, absence de réponse du PM (cl. 61.4), réponse, transmission pour visa, relance de paiement, demande de prolongation, mise en demeure. Archivés automatiquement dans la GED et le registre des échanges.
- **Points d'attention proactifs** : pièces manquantes, forclusion, retard du PM, planning qui dépasse la date contractuelle, glissement entre plannings, visas et paiements en retard, groupement incohérent, revue non faite…
- **Assistant IA** : questions sur le contrat avec citation des sources, analyse des courriers reçus (réponse attendue, risque d'Early Warning), amélioration des courriers.
- **Early Warnings** (NEC cl. 15) : registre, effets potentiels, gravité, prochaine revue, conversion en Compensation Event en un clic.
- **Compensation Events** (NEC cl. 60 à 65) : calcul automatique des délais (notification sous 8 sem., réponse PM 1 sem., devis 3 sem., réponse au devis 2 sem.) et **alerte de forclusion**.
- **Échanges** : dépôt d'emails Outlook `.msg`, `.eml` ou de courriers PDF. L'objet, l'expéditeur, la date, le texte et les pièces jointes sont lus et archivés automatiquement. Suivi des réponses attendues.
- **Planning** : jalons, Key Dates, Completion, frise avec glissements prévus / réels.
- **Tableau de bord et échéancier** : retards, échéances à 30 jours, calendrier mensuel, **export vers Outlook / Google Agenda** (`.ics` avec rappel 3 jours avant).
- **Recherche globale**, **historique** de toutes les actions, **exports Excel** (CSV) de chaque registre.

Tout reste sur ton PC : l'application n'écoute que `localhost`. **Seule exception, que tu actives toi-même** : pour un contrat où tu coches « Autoriser l'IA cloud », les extraits utiles des documents sont envoyés à l'API Claude d'Anthropic. Par défaut, l'IA tourne en local avec Ollama.

---

## Installation pas à pas (Windows)

### Étape 1 : installer Node.js (une seule fois)

1. Va sur <https://nodejs.org/fr/download> et télécharge la version **LTS** (22 ou plus récente).
2. Lance l'installeur et clique sur « Suivant » jusqu'à la fin (options par défaut).
3. Vérification : ouvre l'invite de commandes (touche Windows, tape `cmd`) puis tape `node -v`. Tu dois voir `v22.x.x` ou plus.

### Étape 2 : récupérer l'application

- **Avec Git** : `git clone https://github.com/asimove22/sarahmoula.git`, puis ouvre le dossier `sarahmoula\contrats-app`.
- **Sans Git** : sur GitHub, bouton **Code → Download ZIP**, décompresse-le par exemple dans `C:\Contrats\`, puis ouvre le dossier `contrats-app`.

> Évite de placer le dossier dans OneDrive ou Dropbox : la synchronisation peut corrompre la base pendant son utilisation. Pour la sauvegarde, utilise plutôt l'étape 7.

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

### Étape 5 : activer l'IA (facultatif)

**IA locale (recommandée pour démarrer, gratuite, rien ne sort de ton PC)** :
1. Installe Ollama depuis <https://ollama.com/download>.
2. Dans l'invite de commandes : `ollama pull qwen2.5:7b` (≈ 5 Go ; prévoir 16 Go de RAM).
3. Dans l'application : **Paramètres → Tester Ollama**.

**Claude (meilleure qualité, payant à l'usage)** :
1. Crée une clé sur <https://console.anthropic.com/settings/keys>.
2. **Paramètres** : colle la clé, choisis le modèle (Claude Opus 5.5 par défaut), puis **Tester Claude**.
3. Dans chaque contrat concerné : **Modifier → Autoriser l'IA cloud (Claude)**. Les autres contrats restent en IA locale.

L'IA propose, tu décides : rien de ce qu'elle produit n'est enregistré sans ta validation.

### Étape 6 : utiliser les fonctions avancées

1. **Paramètres** : renseigne la société, l'adresse, la ville et le signataire (en-tête des courriers).
2. **Revue** : « Charger la check-list type », puis « Analyser les pièces avec l'IA » une fois le CCAP / Contract Data / CCTP archivés.
3. **Organisation** : saisis les intervenants, puis le groupement, la matrice RACI (clic sur une case pour changer la lettre) et la matrice de communication (le « type » sert à choisir le destinataire des courriers).
4. **Planning → Plannings & chemin critique** : importe ton planning. MS Project : *Fichier → Enregistrer sous → XML*. Primavera : export *.xer*. Excel/CSV : colonnes `ID`, `Nom`, `Début`, `Fin`, `Prédécesseurs` (ex. `3;5FD+2j`), et en option `Durée`, `WBS`, `%`, `Marge totale`. Importe chaque nouvelle version : l'application compare les dates de fin et signale les glissements.
5. **Visas** : enregistre chaque document transmis ; en cas de refus ou de VAO, « Nouvel indice ».
6. **Finances** : avenants et situations ; une situation non payée à l'échéance passe en rouge et propose une relance.
7. **Courriers** : bouton « Courrier » dans les fenêtres EW, CE, échanges, visas et situations, ou dans la synthèse du contrat. Relis, complète les [crochets], génère le Word. Le courrier est créé avec le statut « à envoyer » : passe-le à « envoyé » une fois expédié.

### Étape 7 : sauvegarder

Double-clique sur **`Sauvegarder.bat`** (de préférence application fermée). Il crée un fichier `sauvegardes\sauvegarde-AAAAMMJJ-HHMM.zip` contenant la base **et** tous les documents. Copie-le régulièrement sur une clé USB ou un disque externe.

**Restaurer** : application fermée, supprime (ou renomme) le dossier `data`, puis décompresse le zip dans `contrats-app` (on doit retrouver `contrats-app\data\contrats.db`).

### Étape 8 : brancher l'agenda

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

1. Lance `Sauvegarder.bat`.
2. Remplace les fichiers de l'application **sans toucher au dossier `data`** (avec Git : `git pull`).
3. Relance `Lancer.bat` : il installe les nouveaux composants, puis la base est **mise à niveau automatiquement** au démarrage (tes données sont conservées). Les documents déjà archivés sont indexés en tâche de fond pour la recherche plein texte.

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
| Réponse du PM à un programme (NEC) | Date de soumission + 2 sem. (cl. 31.3) |
| Prochain programme révisé (NEC) | Dernière soumission + intervalle du Contract Data (cl. 32.2) |
| Visa | Date de transmission + délai de visa du contrat (15 j par défaut) |
| Paiement d'une situation | Échéance saisie, sinon date de remise + délai de paiement (30 j, 21 j en NEC par défaut) |
| Garanties (marchés FR) | Réception + 1 an (parfait achèvement, retenue de garantie) et + 2 ans (biennale) |

Le chemin critique est lu dans le fichier quand il fournit la marge totale (MS Project, Primavera). Sinon (Excel/CSV), la marge est calculée par passe arrière à partir des dates et des liens, **en jours calendaires**.

Les durées NEC sont modifiables contrat par contrat. Les contrats « brouillon », « clôturé », « résilié » ou « archivé » ne génèrent pas d'alerte.

## Limites actuelles

- Les **PDF scannés** (images) ne contiennent pas de texte : ils sont archivés mais ni la recherche ni l'IA ne peuvent les lire (pas d'OCR pour l'instant). Ils sont signalés dans les points d'attention.
- Le format **.mpp** natif de MS Project n'est pas lisible : exporte en XML.
- Pour Excel/CSV, la marge est calculée **en jours calendaires**, sans calendrier de travail.
- L'IA locale (modèle 7B) est nettement moins précise que Claude sur les contrats longs ; dans les deux cas, ses propositions sont à vérifier dans les pièces.

## Pour le développement

```bash
npm install
npm run dev:server   # API sur http://localhost:4580 (rechargement auto)
npm run dev          # interface Vite avec rechargement à chaud
npm test             # tests de l'API (V1 et V2, IA simulée)
npm run typecheck    # vérification TypeScript
```

Architecture : serveur Express (`server/`), base SQLite intégrée à Node (`node:sqlite`, aucune compilation native) avec migrations versionnées (`server/db.js`) et index plein texte FTS5, interface React + Tailwind (`src/`) construite dans `dist/` et servie par le même serveur.

| Module | Rôle |
|---|---|
| `server/extract.js` | Extraction du texte (PDF, DOCX, XLSX, emails) et indexation |
| `server/schedule.js` | Lecture MS Project / Primavera / Excel / CSV, calcul des marges |
| `server/rules.js` | Échéances V2, synthèse financière, points d'attention, check-lists de revue |
| `server/letters.js` | Modèles de courriers et génération Word |
| `server/ai.js` | Ollama (local) ou API Claude (SDK officiel `@anthropic-ai/sdk`), sorties JSON structurées |

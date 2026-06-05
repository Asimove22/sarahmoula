# Instagram Automation — @impactamine

Système d'automatisation complet pour la gestion des publications Instagram via l'**API officielle Meta (Instagram Graph API v21.0)**.

## Fonctionnalités

| Fonctionnalité | Commande CLI |
|---|---|
| Publier une photo | `python cli.py publish photo` |
| Publier un Reel | `python cli.py publish reel` |
| Publier un carrousel | `python cli.py publish carousel` |
| Programmer une publication | `python cli.py publish schedule` |
| Stats d'un post | `python cli.py stats post <ID>` |
| Stats des derniers posts | `python cli.py stats recent` |
| Insights du compte | `python cli.py stats account` |
| Prévisualiser les hashtags | `python cli.py hashtags preview` |

---

## Prérequis

- Python 3.11+
- Compte Instagram **Business** ou **Créateur** lié à une **Page Facebook**
- App Meta créée sur [developers.facebook.com](https://developers.facebook.com)

---

## Installation

```bash
# 1. Cloner et entrer dans le dossier
cd instagram_automation

# 2. Créer un environnement virtuel
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les credentials
cp .env.example .env
# Édite .env et remplis tes valeurs
```

---

## Configuration

### Étape 1 — Lier Instagram à une Page Facebook

1. Facebook.com → ta Page → **Paramètres** → **Comptes liés** → **Instagram**
2. Connecte **@impactamine**
3. Assure-toi d'être en compte **Professionnel**

### Étape 2 — Créer une App Meta

1. [developers.facebook.com](https://developers.facebook.com) → **Créer une App** → type **Business**
2. Tableau de bord → **Ajouter un produit** → **Instagram Graph API**
3. Récupère ton `APP_ID` et `APP_SECRET`

### Étape 3 — Obtenir un Token long-terme

```bash
# Génère un token court dans Graph API Explorer :
# tools.developers.facebook.com/explorer
# Permissions requises : instagram_basic, instagram_content_publish,
#   instagram_manage_insights, pages_read_engagement, pages_show_list

# Échange contre un token long-terme (60 jours) :
python cli.py auth exchange-token TON_TOKEN_COURT

# Récupère ton IG_USER_ID :
python cli.py auth get-ig-id TON_TOKEN_DE_PAGE
```

### Étape 4 — Remplir le fichier `.env`

```env
APP_ID=123456789
APP_SECRET=abcdef123456
ACCESS_TOKEN=EAAxxxxx...
IG_USER_ID=17841400000000000
API_VERSION=v21.0
```

### Vérifier la configuration

```bash
python cli.py auth check
```

---

## Utilisation

### Publier une photo

```bash
python cli.py publish photo \
  --url "https://ton-serveur.com/image.jpg" \
  --caption "Ma légende ici" \
  --themes fitness morocco \
  --hashtags "#coaching" "#amine"
```

> **Note** : L'image doit être hébergée sur une URL publique HTTPS (Cloudinary, S3, Imgur, etc.)

### Publier un Reel

```bash
python cli.py publish reel \
  --url "https://ton-serveur.com/video.mp4" \
  --caption "Mon Reel 🔥" \
  --themes fitness business
```

### Publier un carrousel

```bash
python cli.py publish carousel \
  --urls "https://exemple.com/slide1.jpg" \
  --urls "https://exemple.com/slide2.jpg" \
  --urls "https://exemple.com/slide3.jpg" \
  --caption "Carrousel en 3 slides ⬅️" \
  --themes lifestyle
```

### Programmer une publication

```bash
# Publication le 25 décembre à 18h00
python cli.py publish schedule \
  --type photo \
  --url "https://exemple.com/image.jpg" \
  --caption "Joyeux Noël ! 🎄" \
  --at "2025-12-25T18:00:00" \
  --themes general
```

### Statistiques

```bash
# Stats d'un post spécifique
python cli.py stats post 18012345678901234

# 10 derniers posts
python cli.py stats recent --limit 10

# Insights des 14 derniers jours
python cli.py stats account --days 14

# Export JSON
python cli.py stats recent --json-output > stats.json
```

### Hashtags

```bash
# Voir tous les thèmes disponibles
python cli.py hashtags list

# Prévisualiser une combinaison
python cli.py hashtags preview --themes fitness morocco --custom "#coaching"
```

---

## Structure du projet

```
instagram_automation/
├── src/
│   ├── auth.py          # Authentification OAuth Meta
│   ├── api_client.py    # Client HTTP avec retry/rate-limit
│   ├── publisher.py     # Publication photo/reel/carrousel
│   ├── hashtags.py      # Gestion des hashtags par thème
│   ├── stats.py         # Statistiques et insights
│   └── logger.py        # Configuration logging
├── cli.py               # Interface ligne de commande
├── post_example.py      # Exemples d'utilisation Python
├── config.json          # Configuration (hashtags, limites, etc.)
├── .env.example         # Template variables d'environnement
├── requirements.txt
└── logs/                # Fichiers de log (auto-générés)
```

---

## Gestion des erreurs

| Erreur | Cause | Solution |
|---|---|---|
| `Token expiré` | Token > 60 jours | Régénère un token via `auth exchange-token` |
| `Rate limit atteint` | Trop d'appels API | Attendre (le retry est automatique) |
| `Permissions manquantes` | Scopes insuffisants | Régénère le token avec les bonnes permissions |
| `Conteneur en erreur` | Média invalide | Vérifie format/taille/URL du fichier |
| `URL inaccessible` | Fichier non public | Héberge l'image sur Cloudinary/S3 |

---

## Limites de l'API Meta

- **50 publications** par compte / 24h
- Images : JPG/PNG, max **8 MB**, ratio 4:5 à 1.91:1
- Vidéos Reels : MP4/MOV, 3s–90s, max **1 GB**, ratio 9:16 recommandé
- Légende : max **2200 caractères**, max **30 hashtags**
- Carrousel : **2–10 médias**

---

## Exemple complet (Python API)

Voir [`post_example.py`](./post_example.py) pour des exemples Python complets.

```bash
python post_example.py
```

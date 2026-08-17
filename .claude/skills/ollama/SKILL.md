---
name: ollama
description: Guide pas-à-pas pour installer, configurer et utiliser Ollama (exécuteur de modèles de langage en local) — vérifier si Ollama est installé, l'installer sur Linux/macOS/Windows, démarrer et arrêter le serveur, télécharger/lister/supprimer des modèles, lancer une inférence via `ollama run` ou l'API REST locale (http://localhost:11434), l'intégrer dans du code (Python/JS/curl), et dépanner les problèmes courants (port 11434 déjà utilisé, GPU non détecté, modèle introuvable, serveur qui ne répond pas). Utilise ce skill dès que l'utilisateur mentionne Ollama, un LLM local, `ollama pull`/`ollama run`/`ollama serve`, l'API localhost:11434, ou veut faire tourner un modèle de langage sur sa propre machine sans dépendre d'une API cloud — même s'il ne prononce pas explicitement le mot "Ollama" mais décrit vouloir "un modèle en local", "sans API key", "hors ligne", etc.
---

# Ollama

Ollama est un outil qui fait tourner des modèles de langage (LLM) en local, sur la machine de l'utilisateur, sans dépendre d'une API cloud. Il expose les modèles via une CLI (`ollama`) et une API REST locale sur `http://localhost:11434`.

Ce skill sert de référence pratique pour installer Ollama, gérer ses modèles, et l'utiliser en ligne de commande ou depuis du code. Vérifie toujours l'état réel du système (OS, ce qui est déjà installé, ce qui tourne) avant de proposer une commande — ne suppose rien.

## 1. Vérifier l'état actuel

Avant d'installer quoi que ce soit, vérifie ce qui existe déjà :

```bash
# Ollama est-il installé ?
command -v ollama && ollama --version

# Le serveur tourne-t-il déjà ?
curl -s http://localhost:11434/api/tags
```

- Si `ollama --version` répond → déjà installé, passe à la section 3 (démarrage du serveur) ou 4 (modèles).
- Si la commande `curl` renvoie une liste JSON de modèles (même vide) → le serveur tourne déjà.
- Si rien ne répond → passe à l'installation.

## 2. Installer Ollama

Adapte selon l'OS de l'utilisateur.

### Linux
Script officiel (installe le binaire et configure un service systemd si disponible) :
```bash
curl -fsSL https://ollama.com/install.sh | sh
```
Sur une distribution sans systemd (conteneur, WSL sans systemd), le script installe quand même le binaire ; il faudra démarrer le serveur manuellement (voir section 3).

### macOS
Deux options équivalentes :
```bash
brew install ollama
```
ou télécharger l'app depuis https://ollama.com/download/mac (inclut une icône de menu bar qui gère le démarrage automatique).

### Windows
Télécharger l'installeur `.exe` depuis https://ollama.com/download/windows. L'installation ajoute Ollama au démarrage et l'expose sur `http://localhost:11434` automatiquement — pas de commande shell équivalente fiable, oriente l'utilisateur vers le téléchargement manuel.

### Docker (alternative multiplateforme, utile en CI ou conteneur)
```bash
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```
Omettre `--gpus=all` si aucun GPU n'est disponible (CPU only, plus lent).

## 3. Démarrer / arrêter le serveur

Le serveur doit tourner pour que `ollama run` ou l'API fonctionnent.

```bash
# Démarrer en avant-plan (bloquant, utile pour voir les logs)
ollama serve

# Démarrer en arrière-plan (Linux/macOS)
nohup ollama serve > /tmp/ollama.log 2>&1 &

# Si installé via le script Linux avec systemd
sudo systemctl start ollama
sudo systemctl enable ollama   # démarrage automatique
```

Sur macOS (app) et Windows (installeur), le serveur démarre automatiquement en arrière-plan après l'installation — pas besoin de `ollama serve` manuellement dans ce cas.

## 4. Gérer les modèles

```bash
# Télécharger un modèle (ex: llama3.1, mistral, gemma2, qwen2.5, phi3)
ollama pull llama3.1

# Lister les modèles installés localement
ollama list

# Supprimer un modèle pour libérer de l'espace disque
ollama rm llama3.1

# Voir les détails d'un modèle (taille, paramètres, template)
ollama show llama3.1
```

Le catalogue complet des modèles disponibles est sur https://ollama.com/library — oriente l'utilisateur vers ce lien s'il cherche un modèle en particulier plutôt que de deviner un nom de modèle.

## 5. Lancer une inférence

### En CLI interactive
```bash
ollama run llama3.1
```
Ouvre une session de chat interactive dans le terminal. `/bye` pour quitter.

### En une seule commande (non-interactif, utile en script)
```bash
ollama run llama3.1 "Résume ce texte en trois points : ..."
```

### Via l'API REST locale
Le serveur expose une API compatible avec la plupart des clients HTTP sur `http://localhost:11434`.

```bash
# Génération simple
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1",
  "prompt": "Pourquoi le ciel est bleu ?",
  "stream": false
}'

# Chat avec historique de messages
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.1",
  "messages": [{"role": "user", "content": "Bonjour"}],
  "stream": false
}'
```

Ollama expose aussi une API compatible OpenAI sur `http://localhost:11434/v1`, ce qui permet de réutiliser directement le SDK OpenAI (Python/JS) en changeant seulement `base_url` et une clé API factice :

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
response = client.chat.completions.create(
    model="llama3.1",
    messages=[{"role": "user", "content": "Bonjour"}]
)
```

## 6. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `curl: (7) Failed to connect to localhost port 11434` | Le serveur ne tourne pas | Lancer `ollama serve` (section 3) |
| `Error: listen tcp 127.0.0.1:11434: bind: address already in use` | Une instance tourne déjà | Vérifier avec `curl http://localhost:11434/api/tags` — c'est probablement déjà bon ; sinon `pkill ollama` puis relancer |
| `Error: model 'X' not found` | Modèle non téléchargé, ou nom mal orthographié | `ollama pull X` ; vérifier le nom exact sur https://ollama.com/library |
| Inférence très lente, GPU non utilisé | Drivers GPU absents ou non détectés (NVIDIA/CUDA, AMD/ROCm) | Vérifier `nvidia-smi` (NVIDIA) ; installer les drivers appropriés ; sur Linux, `ollama serve` log indique si le GPU a été détecté au démarrage |
| Modèle trop volumineux pour la RAM/VRAM disponible | Modèle trop gros pour la machine | Choisir une variante quantifiée plus petite (ex: `llama3.1:8b` au lieu de `llama3.1:70b`) — le tag après `:` indique la taille |
| Permission denied sur `/usr/local/bin/ollama` (Linux) | Installation sans droits suffisants | Relancer le script d'installation avec `sudo`, ou installer en mode utilisateur si l'environnement l'exige |

Pour un problème non listé ici, demander à l'utilisateur la sortie de `ollama serve` (logs) et de `ollama --version`, et consulter https://github.com/ollama/ollama/issues si nécessaire.

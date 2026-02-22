# Architecture d'integration — Community Agent x x402 Backend

## 1. Topologie de deploiement

```
                    Internet
                       |
              [x402-backend :3000]         (Render)
              /        |         \
     React SPA    API wrappers   Proxy /admin/community-agent/*
     (Vercel)      (61 endpoints)       |
                                  [community-agent :3500]  (meme instance Render)
                                        |
                          7 plateformes (Telegram, Discord, Twitter...)
```

**Decision** : Le community agent tourne comme process companion sur la meme instance Render que le backend. Le backend expose un proxy authentifie vers l'agent. Pas de communication directe frontend → agent.

**Justification** : Un seul dyno Render simplifie le deploy, le proxy centralise l'auth, et l'agent n'est pas expose publiquement.

## 2. Flux de communication

### 2.1 Frontend → Backend → Agent (proxy)

```
Frontend                    Backend                     Agent
   |                           |                          |
   |-- GET /admin/community-agent/status -->              |
   |                    [adminAuth]                       |
   |                           |-- GET /api/status ------>|
   |                           |<--- JSON response -------|
   |<-- JSON response ---------|                          |
```

Routes proxy dans le backend :
- `GET  /admin/community-agent/status`      → agent `/api/status`
- `GET  /admin/community-agent/settings`    → agent `/api/settings`
- `POST /admin/community-agent/settings`    → agent `/api/settings`
- `GET  /admin/community-agent/queue`       → agent `/api/queue`
- `POST /admin/community-agent/queue/:id/approve` → agent `/api/queue/:id/approve`
- `POST /admin/community-agent/queue/:id/retry`   → agent `/api/queue/:id/retry`
- `DELETE /admin/community-agent/queue/:id` → agent `/api/queue/:id`
- `GET  /admin/community-agent/scheduler`   → agent `/api/scheduler`
- `POST /admin/community-agent/scheduler/start`  → agent `/api/scheduler/start`
- `POST /admin/community-agent/scheduler/stop`   → agent `/api/scheduler/stop`
- `POST /admin/community-agent/scheduler/run-now` → agent `/api/scheduler/run-now`
- `POST /admin/community-agent/preview`     → agent `/api/preview`
- `POST /admin/community-agent/publish`     → agent `/api/publish`
- `GET  /admin/community-agent/logs`        → agent `/api/logs`
- `GET  /admin/community-agent/history`     → agent `/api/history`
- `GET  /admin/community-agent/settings/test/:platform` → agent `/api/settings/test/:platform`

**Total : 16 routes proxy**, toutes protegees par `adminAuth` + `adminAuthLimiter`.

### 2.2 Backend → Agent (webhook)

Quand un nouveau service est enregistre via `POST /register` :

```
Backend register.js                   Agent
   |                                    |
   |-- POST /api/webhook/new-api ------>|
   |   { apiName, apiDescription,       |
   |     apiPrice, apiEndpoint }        |
   |<--- 200 OK -----------------------|
   |                                    |
   (fire-and-forget, log erreur si fail)|
```

Le webhook existe deja dans l'agent (`/api/webhook/new-api`). Le backend a deja `notifyCommunityAgent()` dans `register.js` — il faut juste le brancher sur la bonne URL.

### 2.3 Agent → Backend (consommation APIs)

L'agent appelle deja les APIs x402 via `lib/x402-client.js` avec paiement USDC automatique. Pas de changement necessaire.

## 3. Authentification

```
Layer 1 : Frontend → Backend
  - Header X-Admin-Token (meme token que le dashboard admin existant)
  - adminAuth middleware (timing-safe compare)
  - adminAuthLimiter (10 tentatives / 5 min)

Layer 2 : Backend → Agent
  - Reseau local (localhost:3500), pas d'auth necessaire
  - L'agent n'est pas expose publiquement
  - Optionnel : header X-Internal-Token pour defense en profondeur
```

**Cote frontend** :
- Hook `useAdminAuth` : prompt token → stocke en `sessionStorage`
- Toutes les requetes admin envoient `X-Admin-Token` dans les headers
- Pattern identique au dashboard admin backend existant

## 4. Structure des fichiers (changements)

### Backend (`x402-backend/`)

```
routes/
  community-agent.js    [NOUVEAU] — proxy router, ~80 lignes
server.js               [MODIFIER] — monter le nouveau router
routes/register.js      [MODIFIER] — brancher notifyCommunityAgent() sur URL agent
```

### Frontend (`x402-frontend/`)

```
src/pages/
  AdminCommunityAgent.tsx    [NOUVEAU] — page dashboard agent, ~300 lignes
src/hooks/
  useAdminAuth.ts            [NOUVEAU] — hook auth admin, ~40 lignes
  useCommunityAgent.ts       [NOUVEAU] — hooks React Query pour l'API agent, ~100 lignes
src/App.tsx                  [MODIFIER] — ajouter route /admin/community-agent
src/components/Navbar.tsx    [MODIFIER] — lien admin (visible si auth)
```

### Community Agent (`x402-community-agent/`)

```
dashboard.js                 [MODIFIER] — ajouter endpoint /api/health pour monitoring
```

## 5. Monitoring & Logging

### 5.1 Health check agent

Nouvel endpoint dans l'agent :
```
GET /api/health → { status: 'ok', uptime, scheduler, queue, lastPublish }
```

Le monitoring engine du backend (`lib/monitor.js`) ajoute cet endpoint a sa liste de checks (62 endpoints au lieu de 61). Alerte Telegram si l'agent est down.

### 5.2 Logging centralise

L'agent continue ses logs JSON locaux (200 max, in-memory). Pas de changement. Les logs sont accessibles via le proxy `/admin/community-agent/logs`.

Optionnel futur : l'agent pourrait aussi ecrire dans la table Supabase `activity` du backend (type='community-agent'). Pas necessaire pour le MVP.

### 5.3 Alertes

```
Agent publie avec succes    → log info (visible dans dashboard)
Agent echec publication     → retry automatique (3x, backoff 5/30/60min)
Agent epuise les retries    → alerte Telegram admin (deja en place)
Agent process down          → backend monitoring detecte → alerte Telegram
Nouveau service enregistre  → webhook → agent genere contenu → queue
```

## 6. Deploiement Render

### Option retenue : multi-process sur un seul dyno

Dans `package.json` backend ou `Procfile` :
```
web: node server.js & cd ../x402-community-agent && node dashboard.js & wait
```

Ou mieux, un script `start-all.sh` :
```bash
#!/bin/bash
node server.js &
BACKEND_PID=$!
cd ../x402-community-agent && node dashboard.js &
AGENT_PID=$!
wait $BACKEND_PID $AGENT_PID
```

**Variables d'environnement Render** a ajouter :
- `COMMUNITY_AGENT_URL=http://localhost:3500` (pour le proxy backend)
- Credentials plateformes (TELEGRAM_BOT_TOKEN, DISCORD_WEBHOOK_URL, etc.)

**Alternative** : Deux services Render separes avec communication via URL interne. Plus propre mais plus cher (2 dynos). A considerer si l'agent consomme trop de ressources.

## 7. Priorites d'implementation

| Ordre | Composant | Effort | Impact |
|-------|-----------|--------|--------|
| 1 | Proxy router backend (community-agent.js) | ~2h | Debloque tout le reste |
| 2 | Brancher webhook register → agent | ~30min | Active les annonces auto |
| 3 | Health check endpoint agent | ~15min | Monitoring |
| 4 | Hook useAdminAuth frontend | ~1h | Auth admin |
| 5 | Page AdminCommunityAgent React | ~3h | Dashboard integre |
| 6 | Deploiement Render multi-process | ~1h | Go live |

## 8. Ce qu'on ne change PAS

- L'agent garde son stockage JSON local (pas de migration Supabase)
- L'agent garde son scheduler interne (pas de remplacement par cron externe)
- L'agent garde ses modules de plateformes tels quels
- Le dashboard HTML statique de l'agent reste fonctionnel (acces direct dev)
- Le systeme de paiement x402 de l'agent ne change pas

# Deployment Guide

## Overview

Deployment is split into two independent parts:

- **Part A:** Nakama + PostgreSQL on Railway
- **Part B:** React frontend on Vercel

They are separated because Nakama is a stateful, long-lived real-time server requiring persistent connections, while Vercel is optimized for static assets and serverless functions.

## Part A: Deploy Nakama to Railway

### Prerequisites

- Railway account - [https://railway.app](https://railway.app)
- GitHub repository with this project pushed

### Step 1: Create a new Railway project

In Railway dashboard, click **New Project** and create a blank project or repo-connected project.

### Step 2: Add PostgreSQL

Use **Add Service -> Database -> PostgreSQL**. Railway provisions credentials and connection details automatically.

### Step 3: Connect your repository

Use **Add Service -> GitHub Repo** and select this repository. Railway will use `Dockerfile.nakama` for containerized backend deployment.

### Step 4: Configure the Dockerfile

`Dockerfile.nakama`:

```dockerfile
FROM registry.heroiclabs.com/heroiclabs/nakama:3.21.1
COPY nakama/build/ /nakama/data/modules/
EXPOSE 7349 7350 7351
```

It starts from official Nakama image and injects compiled module artifacts into Nakama's module directory. Runtime start sequence and migration command are provided by `railway.toml`.

### Step 5: Set environment variables in Railway

Required service variables:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | from Railway Postgres service | Convert to Nakama DB address format |
| `PORT` | `7350` | Public app port exposed by Nakama HTTP/WebSocket endpoint |

**DATABASE_URL conversion**

Railway/Postgres often provides URI like:

```text
postgresql://user:password@host:5432/railway
```

Convert to Nakama format:

```text
postgres:password@host:5432/railway
```

Pattern:

```text
postgres:<PASSWORD>@<HOST>:<PORT>/<DATABASE>
```

### Step 6: Run database migrations

`railway.toml` should run `nakama migrate up` before launching server. This initializes Nakama schema tables and applies required migrations automatically.

### Step 7: Get the public URL

Railway assigns a public domain such as:

```text
https://your-app.up.railway.app
```

Save this value for frontend production environment variables.

### Step 8: Verify deployment

```bash
curl https://your-app.up.railway.app/healthcheck
# Expected: {}
```

## Part B: Deploy frontend to Vercel

### Step 1: Configure production environment variables

`frontend/.env.production`:

```bash
VITE_NAKAMA_HOST=your-app.up.railway.app
VITE_NAKAMA_PORT=443
VITE_NAKAMA_USE_SSL=true
VITE_NAKAMA_SERVER_KEY=defaultkey
```

Reasoning: clients connect over HTTPS/WSS through Railway's TLS endpoint (`443`), while Railway forwards to Nakama internal service port.

### Step 2: Deploy via CLI

```bash
cd frontend
npx vercel
```

When prompted, set root directory to `frontend/`.

### Step 3: Or deploy via Vercel dashboard

Connect GitHub repo on Vercel and configure:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `frontend`

### Step 4: Set environment variables in Vercel dashboard

Set the same four `VITE_NAKAMA_*` variables defined for production.

### Step 5: Verify deployment

Open the Vercel URL in two browser tabs, create two users, and verify matchmaking + gameplay works end-to-end.

## Keeping the frontend and backend in sync

After backend logic change (`main.ts`):

1. `cd nakama && npm run build`
2. Commit/push updated compiled output (`nakama/build/main.js`)
3. Railway auto-redeploys from repository changes

After frontend change:

4. Push to repo and let Vercel auto-redeploy frontend

## Environment variable reference (all environments)

| Variable | File | Local value | Production value | What it controls |
|---|---|---|---|---|
| `VITE_NAKAMA_HOST` | `frontend/.env.local` | `127.0.0.1` | `your-app.up.railway.app` | Nakama server hostname |
| `VITE_NAKAMA_PORT` | `frontend/.env.local` | `7350` | `443` | Nakama server port |
| `VITE_NAKAMA_USE_SSL` | `frontend/.env.local` | `false` | `true` | Whether socket/http use TLS (`wss`/`https`) |
| `VITE_NAKAMA_SERVER_KEY` | `frontend/.env.local` | `defaultkey` | `defaultkey` | Nakama server key used by client |
| `NAKAMA_DB_ADDRESS` | `nakama/.env` | `postgres:localdb@localhost:5432/nakama` | via converted Railway DB value | PostgreSQL connection target |
| `NAKAMA_LOGGER_LEVEL` | `nakama/.env` | `DEBUG` | `INFO` | Runtime log verbosity |
| `NAKAMA_SESSION_TOKEN_EXPIRY_SEC` | `nakama/.env` | `7200` | `7200` | Access token lifetime seconds |
```

### Step 6: Run database migrations

`railway.toml` should run `nakama migrate up` before launching server. This initializes Nakama schema tables and applies required migrations automatically.

### Step 7: Get the public URL

Railway assigns a public domain such as:

```text
https://your-app.up.railway.app
```

Save this value for frontend production environment variables.

### Step 8: Verify deployment

```bash
curl https://your-app.up.railway.app/healthcheck
# Expected: {}
```

## Part B: Deploy frontend to Vercel

### Step 1: Configure production environment variables

`frontend/.env.production`:

```bash
VITE_NAKAMA_HOST=your-app.up.railway.app
VITE_NAKAMA_PORT=443
VITE_NAKAMA_USE_SSL=true
VITE_NAKAMA_SERVER_KEY=defaultkey
```

Reasoning: clients connect over HTTPS/WSS through Railway's TLS endpoint (`443`), while Railway forwards to Nakama internal service port.

### Step 2: Deploy via CLI

```bash
cd frontend
npx vercel
```

When prompted, set root directory to `frontend/`.

### Step 3: Or deploy via Vercel dashboard

Connect GitHub repo on Vercel and configure:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `frontend`

### Step 4: Set environment variables in Vercel dashboard

Set the same four `VITE_NAKAMA_*` variables defined for production.

### Step 5: Verify deployment

Open the Vercel URL in two browser tabs, create two users, and verify matchmaking + gameplay works end-to-end.

## Keeping the frontend and backend in sync

After backend logic change (`main.ts`):

1. `cd nakama && npm run build`
2. Commit/push updated compiled output (`nakama/build/main.js`)
3. Railway auto-redeploys from repository changes

After frontend change:

4. Push to repo and let Vercel auto-redeploy frontend

## Environment variable reference (all environments)

| Variable | File | Local value | Production value | What it controls |
|---|---|---|---|---|
| `VITE_NAKAMA_HOST` | `frontend/.env.local` | `127.0.0.1` | `your-app.up.railway.app` | Nakama server hostname |
| `VITE_NAKAMA_PORT` | `frontend/.env.local` | `7350` | `443` | Nakama server port |
| `VITE_NAKAMA_USE_SSL` | `frontend/.env.local` | `false` | `true` | Whether socket/http use TLS (`wss`/`https`) |
| `VITE_NAKAMA_SERVER_KEY` | `frontend/.env.local` | `defaultkey` | `defaultkey` | Nakama server key used by client |
| `NAKAMA_DB_ADDRESS` | `nakama/.env` | `postgres:localdb@localhost:5432/nakama` | via converted Railway DB value | PostgreSQL connection target |
| `NAKAMA_LOGGER_LEVEL` | `nakama/.env` | `DEBUG` | `INFO` | Runtime log verbosity |
| `NAKAMA_SESSION_TOKEN_EXPIRY_SEC` | `nakama/.env` | `7200` | `7200` | Access token lifetime seconds |

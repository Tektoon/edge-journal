# EDGE — Trading Journal (avec Supabase)

Journal de trading avec authentification et synchronisation temps réel.

## ÉTAPE 1 — Base de données Supabase

1. Va sur https://supabase.com → crée un projet gratuit
2. Dans **SQL Editor**, exécute ce SQL :

```sql
create table trades (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users not null,
  date       date not null,
  instrument text not null,
  direction  text not null,
  entry      numeric,
  exit       numeric,
  size       numeric,
  pnl        numeric default 0,
  strategy   text,
  session    text,
  emotions   int default 3,
  notes      text,
  tags       text[],
  created_at timestamptz default now()
);
alter table trades enable row level security;
create policy "user_trades" on trades for all using (auth.uid() = user_id);
```

3. Va dans **Settings → API** et copie ton **Project URL** et ta clé **anon/public**

## ÉTAPE 2 — Configuration

Ouvre `src/supabase.js` et remplace :
- `COLLE_TON_PROJECT_URL_ICI` → ton Project URL
- `COLLE_TA_CLE_ANON_ICI` → ta clé anon

## ÉTAPE 3 — Déploiement Vercel

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/TON_USERNAME/edge-journal.git
git push -u origin main
```

Puis sur https://vercel.com → Add New Project → sélectionne le repo → Deploy.

## Développement local

```bash
npm install
npm run dev
```

# 💪 Workout App

App de treino com React Native + Expo Web, agora com backend em Supabase e painel admin.

## Features

- Login por email/senha (Supabase Auth)
- Weekly workout schedule view by day
- Workout execution with timer and per-exercise checkboxes
- Load and progression tracking per exercise
- Monthly attendance calendar
- Rota `/admin` com CRUD de treinos e exercícios
- Exportação de backup local (IndexedDB -> JSON)

## Tech Stack

- [Expo](https://expo.dev/) + React Native Web
- [Supabase](https://supabase.com/) — Auth + PostgreSQL
- [sql.js](https://sql.js.org/) — fallback local (web via WASM)
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [React Navigation](https://reactnavigation.org/) — screen navigation

## Running Locally

```bash
npm install
npx expo start --web

# opcional: habilita backend real
export EXPO_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="public-anon-key"
```

## Generating the Build

```bash
npx expo export --platform web
```

Static files will be generated in the `dist/` folder.

## Architecture

### Com Supabase (recomendado)

- Auth: email/senha
- Banco: PostgreSQL com schema em `supabase/schema.sql`
- Painel: tela `Admin` (rota `/admin`) para CRUD de treinos e exercícios

### Modo local (fallback)

- Mobile (iOS/Android): SQLite nativo via `expo-sqlite`
- Web/PWA: `sql.js` + IndexedDB
- Backup: botão "Exportar backup" na Home
- **Mobile (iOS/Android):** native SQLite via `expo-sqlite`
- **Web/PWA:** sql.js (SQLite compiled to WebAssembly) + IndexedDB for persistence

## Deploy (Vercel)

- Build command: `npm run build:web`
- Variáveis de ambiente:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Não é mais necessário versionar o conteúdo de `dist/`.

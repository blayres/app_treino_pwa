# 💪 Workout Tracker

A personal workout tracking PWA built with React Native + Expo Web, Supabase for auth and data, and an admin panel for managing students and programs.

---

## Features

- **Email/password authentication** via Supabase Auth
- **Email confirmation flow** — confirmation link opens directly in the app
- **Weekly workout schedule** — workouts listed by day, rest days are non-clickable
- **Workout execution** — timer, per-exercise checkboxes, and load/progression tracking
- **Default program seeding** — new users get a full A/B workout program on signup
- **Monthly attendance calendar** — check-ins highlighted per day, timezone-safe
- **Admin panel** (`/admin`) — CRUD for workouts and exercises, per-student dashboard
- **Student dashboard** — check-in status, weekly frequency, last workout duration, all logged loads
- **Exercise hints** — optional coaching notes shown during workout execution
- **PWA-ready** — installable on iOS/Android from the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev/) 54 + React Native Web |
| Auth + Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| Local fallback (web) | [sql.js](https://sql.js.org/) — SQLite compiled to WebAssembly + IndexedDB |
| Local fallback (mobile) | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) |
| Navigation | [React Navigation](https://reactnavigation.org/) v7 |
| Styling | React Native StyleSheet |

---

## Project Structure

```
├── App.tsx                  # Root — auth boot, navigation container
├── index.ts                 # Entry point
├── src/
│   ├── screens/             # LoginScreen, HomeScreen, WorkoutScreen, AdminScreen, ...
│   ├── components/          # CalendarFrequency, DayWorkouts, Timer, ...
│   ├── services/            # authService, workoutService, attendanceService, adminStatsService, ...
│   ├── store/               # Zustand store (currentUser, activeSession)
│   ├── db/                  # SQLite abstraction (web: sql.js, native: expo-sqlite)
│   └── theme/               # colors, spacing, typography
├── scripts/
│   └── inject-meta.js       # Post-build script — injects PWA meta tags into index.html
└── dist/                    # Build output (generated, not committed)
```

---

## Running Locally

```bash
npm install
npx expo start --web
# then press w or open http://localhost:8081
```

The app works in two modes depending on whether Supabase env vars are set:

| Mode | Trigger | Storage |
|---|---|---|
| **Supabase** | `EXPO_PUBLIC_SUPABASE_*` vars present | PostgreSQL via Supabase |
| **Local** | No env vars | SQLite (sql.js on web, expo-sqlite on mobile) |

### Environment variables

Create a `.env` file at the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Database (Supabase)

### Tables

| Table | Description |
|---|---|
| `profiles` | User profiles linked to Supabase auth (`auth_id`) |
| `exercises` | Exercise library (name, muscles, rest, scheme, hint) |
| `workouts` | Workout days per user (day_of_week, title) |
| `workout_exercises` | Exercises within a workout (ordered) |
| `exercise_loads` | Per-user load and progression tracking |
| `workout_sessions` | Session records (start/end time, duration, completed flag) |
| `attendance` | Daily check-in records per user |

### Default workout seeding

When a new user signs up, a default A/B full-body program is automatically seeded via:
1. A Supabase database trigger on `profiles` INSERT (server-side, always runs)
2. `seedDefaultWorkoutsForUser()` called client-side after profile creation (fallback)

The seed is skipped if the user already has workouts — existing programs are never overwritten.

### Required SQL (run once in Supabase SQL editor)

```sql
-- Add hint column to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS hint TEXT;

-- See src/services/defaultWorkoutService.ts for the full seed SQL
```

---

## Building for Production

```bash
npm run build:web
```

This runs `expo export --platform web` and then `scripts/inject-meta.js` to inject PWA meta tags. Output goes to `dist/`.

---

## Deploying to Vercel

- **Build command:** `npm run build:web`
- **Output directory:** `dist`
- **Environment variables** (set in Vercel dashboard):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The `dist/` folder is not committed to git — Vercel builds it on every deploy.

---

## Auth Flow

```
User opens app
  └── onAuthStateChange fires with INITIAL_SESSION
        ├── Session exists → getOrCreateProfile() → navigate to Home
        └── No session → show Login screen

User clicks email confirmation link
  └── Supabase parses #access_token from URL
        └── onAuthStateChange fires SIGNED_IN
              └── getOrCreateProfile() → navigate to Home automatically
```

The app uses a single `onAuthStateChange` listener as the source of truth for auth state. It never calls `supabase.auth.getUser()` concurrently to avoid localStorage lock contention.

---

## Admin Panel

Navigate to `/admin` while logged in with an admin account.

To grant admin access, set `role: 'admin'` in the user's `profiles` row or in their Supabase auth `user_metadata`.

Features:
- Switch between students
- Per-student dashboard: today's check-in, weekly frequency, last workout duration, all exercise loads
- Create/edit exercises (name, muscles, rest time, scheme, coaching hint)
- Create/edit workouts (title, day of week, exercise order)

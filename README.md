# 💪 Workout App

A workout tracking PWA built with React Native + Expo Web.

## Features

- User profile selection
- Weekly workout schedule view by day
- Workout execution with timer and per-exercise checkboxes
- Load and progression tracking per exercise
- Monthly attendance calendar
- Data stored locally on the device (SQLite via IndexedDB in the browser)

## Tech Stack

- [Expo](https://expo.dev/) + React Native Web
- [sql.js](https://sql.js.org/) — SQLite running in the browser via WebAssembly
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [React Navigation](https://reactnavigation.org/) — screen navigation

## Running Locally

```bash
npm install
npx expo start --web
```

## Generating the Build

```bash
npx expo export --platform web
```

Static files will be generated in the `dist/` folder.

## Architecture

No backend. All data is stored locally:
- **Mobile (iOS/Android):** native SQLite via `expo-sqlite`
- **Web/PWA:** sql.js (SQLite compiled to WebAssembly) + IndexedDB for persistence

## Deploy

Hosted on Vercel with automatic deployment on every push to the `main` branch.

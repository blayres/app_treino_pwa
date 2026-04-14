import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import initSqlJs from 'sql.js'

export type DB = {
  execAsync: (sql: string) => Promise<void>
  runAsync: (sql: string, ...params: any[]) => Promise<{ lastInsertRowId?: number }>
  getAllAsync: <T>(sql: string, ...params: any[]) => Promise<T[]>
  getFirstAsync: <T>(sql: string, ...params: any[]) => Promise<T | null>
}

let dbPromise: Promise<DB>

if (Platform.OS === 'web') {
  dbPromise = (async () => {

    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    const DB_NAME = 'training_app_sqlite';
    const STORE = 'sqlite';

    async function loadDbFile(): Promise<Uint8Array | null> {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE, 'readonly');
          const store = tx.objectStore(STORE);
          const getReq = store.get('db');
          getReq.onsuccess = () => resolve(getReq.result ?? null);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async function saveDbFile(data: Uint8Array) {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          store.put(data, 'db');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }

    const saved = await loadDbFile();
    const db = saved ? new SQL.Database(saved) : new SQL.Database();

    // ---------- PROFESSIONAL DEBOUNCED SAVE ----------

    let saveTimer: any = null
    let saving = false

    function scheduleSave() {
      if (saveTimer) return

      saveTimer = setTimeout(async () => {
        if (saving) return
        saving = true

        try {
          const data = db.export()
          await saveDbFile(data)
        } finally {
          saving = false
          saveTimer = null
        }
      }, 500)
    }

    // -------------------------------------------------

    const api: DB = {

      execAsync: async (sql: string) => {
        console.log('[DB][execAsync]', sql);
        db.exec(sql)
        scheduleSave()
      },

      runAsync: async (sql: string, ...params: any[]) => {
        console.log('[DB][runAsync]', sql, params);
        const stmt = db.prepare(sql)
        stmt.bind(params)
        stmt.step()
        stmt.free()

        const result = db.exec('SELECT last_insert_rowid() as id')

        let id: number | undefined = undefined

        if (result.length > 0) {
          const value = result[0].values?.[0]?.[0]
          if (typeof value === 'number') {
            id = value
          }
        }

        scheduleSave()

        return { lastInsertRowId: id }
      },

      getAllAsync: async <T>(sql: string, ...params: any[]) => {
        console.log('[DB][getAllAsync]', sql, params);
        const stmt = db.prepare(sql)
        stmt.bind(params)

        const rows: T[] = []

        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T)
        }
        console.log('[DB][getAllAsync][rows]', rows.length);

        stmt.free()

        return rows
      },

      getFirstAsync: async <T>(sql: string, ...params: any[]) => {
        console.log('[DB][getFirstAsync]', sql, params);
        const stmt = db.prepare(sql)
        stmt.bind(params)

        let row: T | null = null

        if (stmt.step()) {
          row = stmt.getAsObject() as T
        }

        console.log('[DB][getFirstAsync][result]', row);

        stmt.free()

        return row
      },
    }

    return api

  })()
} else {

  dbPromise = (async () => {

    const native = await SQLite.openDatabaseAsync('training_app.db')

    const api: DB = {
      execAsync: native.execAsync.bind(native),
      runAsync: native.runAsync.bind(native),
      getAllAsync: native.getAllAsync.bind(native),
      getFirstAsync: native.getFirstAsync.bind(native),
    }

    return api

  })()
}

export async function getDb(): Promise<DB> {
  return dbPromise
}

export type ExerciseRow = {
  id: number
  name: string
  primary_muscle: string | null
  secondary_muscle: string | null
  rest_seconds: number
  scheme: string
}

export type WorkoutRow = {
  id: number
  user_id: number
  day_of_week: number
  title: string
}

export type WorkoutExerciseRow = {
  id: number
  workout_id: number
  exercise_id: number
  order_index: number
}

export async function initDatabase() {
  const db = await getDb();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      primary_muscle TEXT,
      secondary_muscle TEXT,
      rest_seconds INTEGER NOT NULL,
      scheme TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      title TEXT NOT NULL,
      UNIQUE (user_id, day_of_week),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      workout_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (workout_id) REFERENCES workouts(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS exercise_loads (
      id INTEGER PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      load_kg REAL,
      progression_kg REAL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, exercise_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      workout_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (workout_id) REFERENCES workouts(id)
    );
    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      UNIQUE (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  await seedDatabase(db);
}

// async function seedDatabase(db: DB) {
//   await db.execAsync(`
//     INSERT OR IGNORE INTO users (id, name) VALUES
//       (1, 'Diandra'),
//       (2, 'Barbara');
 
//     INSERT OR IGNORE INTO exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme) VALUES
//       -- Inferior
//       ('Cadeira Extensora',        'quadriceps',       null,          120, '4x10-12'),
//       ('Leg Press 45°',            'quadriceps',       'gluteos',     120, '4x10-12'),
//       ('Leg Press 45° Perna Aberta','adutor',          'gluteos',     120, '4x12'),
//       ('Afundo',                   'gluteos',          'quadriceps',  90,  '3x10 cada perna'),
//       ('Agachamento Sumô',         'adutor',           'gluteos',     90,  '3x12-15'),
//       ('Abdutora 45°',             'gluteos',          null,          90,  '3x15-20'),
//       ('Stiff',                    'posterior',        'gluteos',     120, '4x10-12'),
//       ('Cadeira Flexora',          'posterior',        null,          90,  '3x10-12'),
//       ('Búlgaro',                  'gluteos',          'quadriceps',  120, '3x8-10 cada perna'),
 
//       -- Superior
//       ('Graviton',                 'costas',           'biceps',      120, '4x6-8'),
//       ('Remada na Máquina',        'costas',           'biceps',      90,  '3x10-12'),
//       ('Fly Inverso',              'ombro posterior',  null,          90,  '3x12-15'),
//       ('Desenvolvimento no Banco', 'ombros',           'triceps',     90,  '3x10-12'),
//       ('Elevação Lateral',         'ombros',           null,          60,  '3x12-15'),
//       ('Supino na Máquina',        'peito',            'triceps',     90,  '3x10-12'),
//       ('Bíceps + Tríceps Máquina', 'bracos',           null,          60,  '3x12-15'),
 
//       -- Core e lombar
//       ('Lombar',                   'lombar',           'gluteos',     90,  '3x12-15'),
//       ('Prancha',                  'core',             null,          60,  '3x40-60s'),
//       ('Abdominal Crunch',         'core',             null,          60,  '3x12-15'),
//       ('Elevação de Pernas',       'core',             null,          60,  '3x10-12'),
//       ('Panturrilha no Leg Press', 'panturrilha',      null,          60,  '4x15-20');
//   `);

async function seedDatabase(db: DB) {
  await db.execAsync(`
    INSERT OR IGNORE INTO users (id, name) VALUES
      (1, 'Diandra'),
      (2, 'Barbara');

    INSERT OR IGNORE INTO exercises (name, primary_muscle, secondary_muscle, rest_seconds, scheme) VALUES
      ('Cadeira Extensora', 'quadriceps', null, 120, '3x10-12'),
      ('Leg Press', 'quadriceps', 'gluteos', 120, '4x8-10'),
      ('Afundo', 'gluteos', 'quadriceps', 120, '3x10 cada perna'),
      ('Agachamento Sumô', 'adutor', 'gluteos', 120, '3x10-12'),
      ('Abdutora 45°', 'gluteos', null, 120, '3x12-15'),

      ('Stiff', 'posterior', 'gluteos', 120, '4x8-10'),
      ('Cadeira Flexora', 'posterior', null, 120, '3x10-12'),
      ('Búlgaro', 'gluteos', 'quadriceps', 120, '3x8-10 cada perna'),

      ('Graviton', 'costas', 'biceps', 90, '4x6-10'),
      ('Desenvolvimento no Banco', 'ombros', 'triceps', 90, '3x8-10'),
      ('Remada', 'costas', 'biceps', 90, '3x8-10'),
      ('Fly Inverso', 'ombro posterior', null, 90, '3x12-15'),
      ('Bíceps + Tríceps Máquina', 'bracos', null, 90, '3x10-12'),

      ('Supino', 'peito', 'triceps', 90, '3x8-10'),
      ('Elevação Lateral', 'ombros', null, 90, '3x12'),

      ('Abdominal Crunch', 'core', null, 60, '3x12-15'),
      ('Elevação de Pernas', 'core', null, 60, '3x10-12'),
      ('Lombar', 'lombar', 'gluteos', 90, '3x12-15'),
      ('Panturrilha no Leg Press', 'panturrilha', null, 90, '4x10-15'),
      ('Prancha', 'core', null, 60, '3x30-45s');
  `);

  const exerciseRows = await db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM exercises;`
  );
  const idByName: Record<string, number> = {};
  exerciseRows.forEach((row) => {
    idByName[row.name] = row.id;
  });

  const id = (name: string) => idByName[name];

  type WorkoutDef = [number, string, number[]];

  // // ─── Diandra ────────────────────────────────────────────────────────────────
  // const programUser1: WorkoutDef[] = [
  //   [1, 'Segunda – Inferior A', [
  //     id('Cadeira Extensora'),       // amplitude parcial 0–60°, protege patela
  //     id('Leg Press 45°'),           // descer até 90°, não ultrapassar
  //     id('Abdutora 45°'),            // glúteo médio + formato redondo
  //     id('Afundo'),                  // passada longa para mais glúteo
  //     id('Agachamento Sumô'),        // adutor + glúteo
  //   ]],
  //   [2, 'Terça – Superior A', [
  //     id('Graviton'),                // prioridade: evolução para barra
  //     id('Remada na Máquina'),       // costas + postura
  //     id('Fly Inverso'),             // deltoide posterior, alivia pescoço
  //     id('Desenvolvimento no Banco'),// ombros
  //     id('Elevação Lateral'),        // ombros, carga leve
  //   ]],
  //   [3, 'Quarta – Core + Panturrilha', [
  //     id('Prancha'),                 // core estabilizador
  //     id('Abdominal Crunch'),        // reto abdominal
  //     id('Elevação de Pernas'),      // core inferior
  //     id('Lombar'),                  // cadeia posterior + postura
  //     id('Panturrilha no Leg Press'),// amplitude total, pausa no topo
  //   ]],
  //   [4, 'Quinta – Inferior B', [
  //     id('Stiff'),                   // posterior + glúteo, joelhos semi-flexos
  //     id('Búlgaro'),                 // glúteo superior + posterior
  //     id('Cadeira Flexora'),         // posterior, controle na descida
  //     id('Abdutora 45°'),            // segunda vez: saúde do joelho + glúteo
  //     id('Agachamento Sumô'),        // variação com carga progressiva
  //   ]],
  //   [5, 'Sexta – Superior B', [
  //     id('Graviton'),                // segunda sessão semanal, varia pegada
  //     id('Supino na Máquina'),       // peito + tríceps, controle seguro
  //     id('Remada na Máquina'),       // costas, varia pegada
  //     id('Fly Inverso'),             // reforço postura + pescoço
  //     id('Bíceps + Tríceps Máquina'),// tonificar sem inchar, 15 reps
  //   ]],
  // ];

  // // ─── Barbara ────────────────────────────────────────────────────────────────
  // const programUser2: WorkoutDef[] = [
  //   [1, 'Segunda – Inferior A', [
  //     id('Leg Press 45° Perna Aberta'), // sem leg press 90°, angulação segura
  //     id('Cadeira Extensora'),          // amplitude parcial 0–60°
  //     id('Agachamento Sumô'),           // favorito: adutor + glúteo
  //     id('Afundo'),                     // passada longa, tronco ereto
  //     id('Abdutora 45°'),               // glúteo médio, contração 1s no topo
  //   ]],
  //   [2, 'Terça – Superior A', [
  //     id('Remada na Máquina'),          // escápulas retraem, pescoço neutro
  //     id('Graviton'),                   // progressão a cada 2 semanas
  //     id('Fly Inverso'),                // crucial para dor cervical
  //     id('Desenvolvimento no Banco'),   // ombro + alívio cervical
  //     id('Bíceps + Tríceps Máquina'),   // definição, rep range alto
  //   ]],
  //   [3, 'Quarta – Core + Panturrilha', [
  //     id('Lombar'),                     // prioridade: dor lombar dela
  //     id('Prancha'),                    // core + lombar
  //     id('Abdominal Crunch'),           // sem puxar pescoço
  //     id('Elevação de Pernas'),         // lombar colada no banco
  //     id('Panturrilha no Leg Press'),   // desenvolver panturrilha + alivia dor
  //   ]],
  //   [4, 'Quinta – Inferior B', [
  //     id('Stiff'),                      // ponto fraco: posterior encurtado
  //     id('Búlgaro'),                    // glúteo superior + posterior
  //     id('Cadeira Flexora'),            // volume adicional no ponto fraco
  //     id('Agachamento Sumô'),           // segundo dia, ela gosta
  //     id('Abdutora 45°'),               // glúteo firme requer frequência
  //   ]],
  //   [5, 'Sexta – Superior B', [
  //     id('Graviton'),                   // segunda sessão, varia pegada
  //     id('Supino na Máquina'),          // controle, sem arquejar lombar
  //     id('Elevação Lateral'),           // alivia tensão cervical
  //     id('Fly Inverso'),                // segundo reforço semanal para pescoço
  //     id('Bíceps + Tríceps Máquina'),   // tonificar sem inchar
  //   ]],
  // ];

  const programUser1: WorkoutDef[] = [
    [1, 'Inferior A', [
      id('Cadeira Extensora'),
      id('Leg Press'),
      id('Afundo'),
      id('Agachamento Sumô'),
      id('Abdutora 45°'),
    ]],
    [2, 'Superior A', [
      id('Graviton'),
      id('Desenvolvimento no Banco'),
      id('Remada'),
      id('Bíceps + Tríceps Máquina'),
      id('Fly Inverso'),
    ]],
    [3, 'Core + Panturrilha', [
      id('Abdominal Crunch'),
      id('Elevação de Pernas'),
      id('Lombar'),
      id('Panturrilha no Leg Press'),
      id('Prancha'),
    ]],
    [4, 'Inferior B', [
      id('Stiff'),
      id('Cadeira Flexora'),
      id('Búlgaro'),
      id('Leg Press'),
      id('Abdutora 45°'),
    ]],
    [5, 'Superior B', [
      id('Graviton'),
      id('Supino'),
      id('Elevação Lateral'),
      id('Fly Inverso'),
      id('Bíceps + Tríceps Máquina'),
    ]],
  ];

  const programUser2: WorkoutDef[] = [
    [1, 'Segunda', [
      id('Leg Press'),
      id('Cadeira Extensora'),
      id('Agachamento Sumô'),
      id('Afundo'),
      id('Abdutora 45°'),
    ]],
    [2, 'Superior A', [
      id('Remada'),
      id('Graviton'),
      id('Fly Inverso'),
      id('Desenvolvimento no Banco'),
      id('Bíceps + Tríceps Máquina'),
    ]],
    [3, 'Core + Panturrilha', [
      id('Prancha'),
      id('Lombar'),
      id('Abdominal Crunch'),
      id('Elevação de Pernas'),
      id('Panturrilha no Leg Press'),
    ]],
    [4, 'Inferior B', [
      id('Búlgaro'),
      id('Stiff'),
      id('Leg Press'),
      id('Cadeira Flexora'),
      id('Abdutora 45°'),
    ]],
    [5, 'Superior B', [
      id('Supino'),
      id('Graviton'),
      id('Fly Inverso'),
      id('Elevação Lateral'),
      id('Bíceps + Tríceps Máquina'),
    ]],
  ];

  // Check if seed was already done
  const existingUsers = await db.getAllAsync<{ id: number }>(`SELECT id FROM users;`);

  console.log('[DB][SEED] existingUsers:', existingUsers);
  const insertProgram = async (userId: number, program: WorkoutDef[]) => {
    for (const [dayOfWeek, title, exerciseIds] of program) {
      // Delete existing workout for this day if exists
      await db.runAsync(`DELETE FROM workouts WHERE user_id = ? AND day_of_week = ?;`, userId, dayOfWeek);

      const result = await db.runAsync(
        `INSERT INTO workouts (user_id, day_of_week, title)
         VALUES (?, ?, ?);`,
        userId,
        dayOfWeek,
        title,
      );
      const workoutId = result.lastInsertRowId;

      // Insert exercises
      for (let index = 0; index < exerciseIds.length; index += 1) {
        const exerciseId = exerciseIds[index];
        await db.runAsync(
          `INSERT INTO workout_exercises (workout_id, exercise_id, order_index)
           VALUES (?, ?, ?);`,
          workoutId,
          exerciseId,
          index,
        );
      }
    }
  };

  if (existingUsers.length === 0) {
    // First time seeding - insert normally
    await insertProgram(1, programUser1);
    await insertProgram(2, programUser2);
  } else {
    // Users exist - clean and reinsert to fix duplicates
    // Delete all workout_exercises first (cascade would be better, but SQLite doesn't support it well)
    await db.runAsync(`DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id IN (1, 2));`);
    // Then delete workouts
    await db.runAsync(`DELETE FROM workouts WHERE user_id IN (1, 2);`);
    // Reinsert
    await insertProgram(1, programUser1);
    await insertProgram(2, programUser2);
  }
}



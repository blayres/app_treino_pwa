-- Execute este script no SQL Editor do Supabase.

create table if not exists profiles (
  id bigint generated always as identity primary key,
  auth_id uuid unique not null,
  name text not null,
  role text not null default 'student' check (role in ('admin', 'student'))
);

create table if not exists exercises (
  id bigint generated always as identity primary key,
  name text unique not null,
  primary_muscle text,
  secondary_muscle text,
  rest_seconds integer not null,
  scheme text not null
);

create table if not exists workouts (
  id bigint generated always as identity primary key,
  user_id bigint not null references profiles(id),
  day_of_week integer not null,
  title text not null,
  unique (user_id, day_of_week)
);

create table if not exists workout_exercises (
  id bigint generated always as identity primary key,
  workout_id bigint not null references workouts(id) on delete cascade,
  exercise_id bigint not null references exercises(id),
  order_index integer not null
);

create table if not exists exercise_loads (
  id bigint generated always as identity primary key,
  user_id bigint not null references profiles(id),
  exercise_id bigint not null references exercises(id),
  load_kg numeric,
  progression_kg numeric,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table if not exists workout_sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null references profiles(id),
  workout_id bigint not null references workouts(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  completed integer not null default 0
);

create table if not exists attendance (
  id bigint generated always as identity primary key,
  user_id bigint not null references profiles(id),
  date date not null,
  unique (user_id, date)
);

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table exercise_loads enable row level security;
alter table workout_sessions enable row level security;
alter table attendance enable row level security;

-- Em produção, substitua por policies mais restritivas.
create policy "authenticated read profiles" on profiles for select to authenticated using (true);
create policy "authenticated read exercises" on exercises for select to authenticated using (true);
create policy "authenticated read workouts" on workouts for select to authenticated using (true);
create policy "authenticated read workout_exercises" on workout_exercises for select to authenticated using (true);
create policy "authenticated rw own loads" on exercise_loads for all to authenticated using (true) with check (true);
create policy "authenticated rw sessions" on workout_sessions for all to authenticated using (true) with check (true);
create policy "authenticated rw attendance" on attendance for all to authenticated using (true) with check (true);
create policy "authenticated rw workouts" on workouts for all to authenticated using (true) with check (true);
create policy "authenticated rw exercises" on exercises for all to authenticated using (true) with check (true);
create policy "authenticated rw workout_exercises" on workout_exercises for all to authenticated using (true) with check (true);

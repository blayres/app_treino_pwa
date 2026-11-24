import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(__dirname, '../supabase/migration_workout_schedule.sql'), 'utf8');

describe('migration_workout_schedule.sql', () => {
  it('adds workouts.schedule, weekly by default, so existing programs are unchanged', () => {
    expect(sql).toContain("add column if not exists schedule text not null default 'week'");
  });

  it("only accepts the app's two modes, and can run twice", () => {
    expect(sql).toContain("check (schedule in ('week', 'sequence'))");
    expect(sql).toMatch(/if not exists \(select 1 from pg_constraint where conname = 'workouts_schedule_check'\)/);
  });
});

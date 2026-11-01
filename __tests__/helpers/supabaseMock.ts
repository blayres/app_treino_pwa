/**
 * In-memory stand-in for the Supabase client used by the services.
 *
 * - Records every query: table, action (select/insert/update/upsert/delete),
 *   payload, options and the filter/modifier chain (eq, is, neq, in, order…).
 * - Answers with results queued per "table.action" (or "rpc.name"), in order;
 *   unqueued calls resolve to `{ data: null, error: null }`.
 *
 * Usage in a test file (the factory must `require` this module so the test and
 * the service share the same singleton):
 *
 *   jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
 *   jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));
 *   import { supabaseMock } from './helpers/supabaseMock';
 *   supabaseMock.queue('workouts.select', { data: [...], error: null });
 */

type Result = { data?: unknown; error?: unknown; count?: number | null };
type Action = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export type RecordedQuery = {
  table: string;
  action: Action;
  payload?: unknown;
  options?: unknown;
  /** e.g. ['eq', 'user_id', 1], ['is', 'ended_at', null], ['single'] */
  chain: unknown[][];
};

export type RecordedRpc = { name: string; args: unknown };

const FILTERS = [
  'eq', 'neq', 'is', 'in', 'gt', 'gte', 'lt', 'lte', 'ilike', 'like', 'match', 'not', 'or',
  'order', 'limit', 'range', 'single', 'maybeSingle',
];

class SupabaseMock {
  queries: RecordedQuery[] = [];
  rpcs: RecordedRpc[] = [];
  private results = new Map<string, Result[]>();

  auth = {
    getUser: jest.fn(async () => ({ data: { user: null as any }, error: null as any })),
    signOut: jest.fn(async (_opts?: unknown) => ({ error: null as any })),
    signInWithPassword: jest.fn(async () => ({ error: null as any })),
    signUp: jest.fn(async () => ({ error: null as any })),
    signInWithOAuth: jest.fn(async () => ({ error: null as any })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null as any })),
  };

  /** Queue one or more results for "table.action" or "rpc.functionName". */
  queue(key: string, ...results: Result[]) {
    const list = this.results.get(key) ?? [];
    list.push(...results);
    this.results.set(key, list);
  }

  reset() {
    this.queries = [];
    this.rpcs = [];
    this.results.clear();
    Object.values(this.auth).forEach((fn) => fn.mockClear());
  }

  /** Queries for a table (optionally a single action), in call order. */
  calls(table: string, action?: Action): RecordedQuery[] {
    return this.queries.filter((q) => q.table === table && (!action || q.action === action));
  }

  private take(key: string): Result {
    const list = this.results.get(key);
    const next = list?.shift();
    return { data: null, error: null, ...(next ?? {}) };
  }

  from = (table: string) => {
    const query: RecordedQuery = { table, action: 'select', chain: [] };
    let started = false;
    const builder: any = {};

    const start = (action: Action, payload?: unknown, options?: unknown) => {
      started = true;
      query.action = action;
      query.payload = payload;
      query.options = options;
      this.queries.push(query);
      return builder;
    };

    builder.select = (columns?: string, options?: unknown) => {
      // select() after insert/update/upsert/delete is a "returning" modifier.
      if (started) {
        query.chain.push(['select', columns]);
        return builder;
      }
      return start('select', columns, options);
    };
    builder.insert = (payload: unknown, options?: unknown) => start('insert', payload, options);
    builder.update = (payload: unknown, options?: unknown) => start('update', payload, options);
    builder.upsert = (payload: unknown, options?: unknown) => start('upsert', payload, options);
    builder.delete = (options?: unknown) => start('delete', undefined, options);
    for (const name of FILTERS) {
      builder[name] = (...args: unknown[]) => {
        query.chain.push([name, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(this.take(`${table}.${query.action}`)).then(resolve, reject);
    return builder;
  };

  rpc = jest.fn(async (name: string, args?: unknown) => {
    this.rpcs.push({ name, args });
    return this.take(`rpc.${name}`);
  });
}

export const supabaseMock = new SupabaseMock();

/** Module shape of src/services/supabaseClient for jest.mock factories. */
export const supabaseModule = {
  supabase: supabaseMock,
  ensureSupabaseEnabled: () => {},
};

/** A filter in a recorded query, e.g. filter(q, 'eq', 'user_id') → ['eq','user_id',1]. */
export function filter(query: RecordedQuery, name: string, column?: string) {
  return query.chain.find((c) => c[0] === name && (column === undefined || c[1] === column));
}

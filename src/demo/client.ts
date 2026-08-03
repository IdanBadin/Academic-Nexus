/**
 * A stand-in for the Supabase client that serves the demo fixtures from memory.
 *
 * The app talks to this through exactly the same calls it makes against the
 * real client, so every page, hook, and query in the codebase works unchanged.
 * When real Supabase credentials are present in .env, src/lib/supabase.ts hands
 * back the real client instead and none of this runs.
 *
 * What it covers, because that is what the app actually calls:
 *   from(t).select(cols, {count, head}) .insert .update .upsert .delete
 *          .eq .neq .in .gte .lte .or .match .order .limit .single .maybeSingle
 *   auth.getSession .onAuthStateChange .signUp .signInWithPassword .signOut
 *   channel(name).on('postgres_changes', filter, cb).subscribe() / removeChannel
 *
 * Writes land in memory and survive navigation but reset on a page reload.
 * Who you are signed in as is kept in localStorage so a refresh keeps you there.
 */

import { buildFixtures, DEMO_ACCOUNTS } from './fixtures'
import type { AppRole } from '@/types/db'

type Row = Record<string, unknown>
type Table = keyof ReturnType<typeof buildFixtures>

const SESSION_KEY = 'academic-nexus-demo-session'

/* ------------------------------------------------------------------ store */

let store = buildFixtures() as unknown as Record<string, Row[]>

/**
 * Email to profile id. The Profile type has no email column (the real schema
 * keeps those in auth.users), so sign-in resolves through this index instead of
 * reading a field off the row. Seeded with the three demo accounts and extended
 * whenever someone signs up.
 */
let emailIndex = buildEmailIndex()

function buildEmailIndex(): Map<string, string> {
  return new Map(DEMO_ACCOUNTS.map((account) => [account.email.toLowerCase(), account.userId]))
}

export function resetDemoStore() {
  store = buildFixtures() as unknown as Record<string, Row[]>
  emailIndex = buildEmailIndex()
}

function rowsOf(table: string): Row[] {
  if (!store[table]) store[table] = []
  return store[table]
}

function uuid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Network calls are never instant. A small delay keeps loading states honest. */
function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 120))
}

/* ------------------------------------------------------------- embeds */

interface Embed {
  alias: string
  target: string
  localKey: string
}

/**
 * Pulls the embedded relations out of a PostgREST select string.
 *
 *   "*, expert:profiles!listings_expert_id_fkey(*)" -> expert via expert_id
 *   "*, listing:listings(*)"                        -> listing via listing_id
 *
 * With an explicit foreign key hint the local column is read out of the
 * constraint name. Without one it falls back to "<alias>_id", which is the
 * convention every table in this schema follows.
 */
function parseEmbeds(select: string): Embed[] {
  const embeds: Embed[] = []
  const pattern = /(\w+):(\w+)(?:!([\w]+))?\(([^)]*)\)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(select)) !== null) {
    const [, alias, target, fkHint] = match
    let localKey = `${alias}_id`
    if (fkHint) {
      const fk = fkHint.match(/^\w+?_(\w+_id)_fkey$/)
      if (fk) localKey = fk[1]
    }
    embeds.push({ alias, target, localKey })
  }

  return embeds
}

function applyEmbeds(rows: Row[], embeds: Embed[]): Row[] {
  if (embeds.length === 0) return rows
  return rows.map((row) => {
    const next: Row = { ...row }
    for (const embed of embeds) {
      const key = row[embed.localKey]
      next[embed.alias] =
        key == null ? null : (rowsOf(embed.target).find((r) => r.id === key) ?? null)
    }
    return next
  })
}

/* ------------------------------------------------------------- realtime */

type ChangeHandler = (payload: { eventType: string; new: Row; old: Row | null }) => void

interface Listener {
  table: string
  event: string
  filterColumn?: string
  filterValue?: string
  handler: ChangeHandler
}

const listeners = new Set<Listener>()

function emit(table: string, eventType: string, row: Row) {
  for (const listener of listeners) {
    if (listener.table !== table) continue
    if (listener.event !== '*' && listener.event !== eventType) continue
    if (listener.filterColumn && row[listener.filterColumn] !== listener.filterValue) continue
    // Realtime is asynchronous in reality, so never call back synchronously.
    setTimeout(() => listener.handler({ eventType, new: row, old: null }), 40)
  }
}

/* -------------------------------------------------------------- filters */

type Filter = (row: Row) => boolean

/* --------------------------------------------------------- query builder */

interface Result<T> {
  data: T
  error: { message: string } | null
  count?: number
}

class QueryBuilder implements PromiseLike<Result<unknown>> {
  private filters: Filter[] = []
  private embeds: Embed[] = []
  private orderBy: { column: string; ascending: boolean }[] = []
  private limitTo: number | null = null
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row[] = []
  private wantsCount = false
  private headOnly = false
  private singleMode: 'one' | 'maybe' | null = null
  private returning = true

  constructor(private table: string) {}

  /* -- shaping -- */

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.embeds = parseEmbeds(columns)
    this.wantsCount = Boolean(options?.count)
    this.headOnly = Boolean(options?.head)
    if (this.mode === 'select') this.returning = true
    return this
  }

  insert(values: Row | Row[]) {
    this.mode = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = 'upsert'
    this.payload = Array.isArray(values) ? values : [values]
    this.conflictKey = options?.onConflict ?? 'id'
    return this
  }

  update(values: Row) {
    this.mode = 'update'
    this.payload = [values]
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  private conflictKey = 'id'

  /* -- filters -- */

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value)
    return this
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }

  gte(column: string, value: string | number) {
    this.filters.push((row) => compare(row[column], value) >= 0)
    return this
  }

  lte(column: string, value: string | number) {
    this.filters.push((row) => compare(row[column], value) <= 0)
    return this
  }

  gt(column: string, value: string | number) {
    this.filters.push((row) => compare(row[column], value) > 0)
    return this
  }

  lt(column: string, value: string | number) {
    this.filters.push((row) => compare(row[column], value) < 0)
    return this
  }

  match(criteria: Row) {
    this.filters.push((row) => Object.entries(criteria).every(([k, v]) => row[k] === v))
    return this
  }

  /** Supports the "col.eq.value,other.eq.value" form the app uses. */
  or(expression: string) {
    const clauses = expression.split(',').map((clause) => {
      const [column, op, value] = clause.split('.')
      return { column, op, value }
    })
    this.filters.push((row) =>
      clauses.some(({ column, op, value }) => {
        if (op === 'eq') return String(row[column]) === value
        if (op === 'neq') return String(row[column]) !== value
        return false
      })
    )
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number) {
    this.limitTo = count
    return this
  }

  single() {
    this.singleMode = 'one'
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }

  /* -- execution -- */

  private run(): Result<unknown> {
    const rows = rowsOf(this.table)
    const matching = () => rows.filter((row) => this.filters.every((f) => f(row)))

    let output: Row[] = []

    if (this.mode === 'insert' || this.mode === 'upsert') {
      for (const values of this.payload) {
        const prepared: Row = {
          id: values.id ?? uuid(),
          created_at: values.created_at ?? new Date().toISOString(),
          ...values,
        }

        if (this.mode === 'upsert') {
          const index = rows.findIndex((row) => row[this.conflictKey] === prepared[this.conflictKey])
          if (index >= 0) {
            rows[index] = { ...rows[index], ...prepared }
            output.push(rows[index])
            emit(this.table, 'UPDATE', rows[index])
            continue
          }
        }

        rows.push(prepared)
        output.push(prepared)
        emit(this.table, 'INSERT', prepared)
      }
    } else if (this.mode === 'update') {
      for (const row of matching()) {
        Object.assign(row, this.payload[0])
        output.push(row)
        emit(this.table, 'UPDATE', row)
      }
    } else if (this.mode === 'delete') {
      for (const row of matching()) {
        const index = rows.indexOf(row)
        if (index >= 0) rows.splice(index, 1)
        output.push(row)
        emit(this.table, 'DELETE', row)
      }
    } else {
      output = matching()
    }

    const total = output.length

    if (this.orderBy.length > 0) {
      output = [...output].sort((a, b) => {
        for (const { column, ascending } of this.orderBy) {
          const result = compare(a[column], b[column])
          if (result !== 0) return ascending ? result : -result
        }
        return 0
      })
    }

    if (this.limitTo !== null) output = output.slice(0, this.limitTo)

    output = applyEmbeds(output, this.embeds)

    if (this.headOnly) {
      return { data: null, error: null, count: total }
    }

    if (this.singleMode) {
      if (output.length === 0) {
        return this.singleMode === 'maybe'
          ? { data: null, error: null }
          : { data: null, error: { message: 'No rows found' } }
      }
      return { data: output[0], error: null }
    }

    const result: Result<unknown> = { data: this.returning ? output : null, error: null }
    if (this.wantsCount) result.count = total
    return result
  }

  then<TResult1 = Result<unknown>, TResult2 = never>(
    onfulfilled?: ((value: Result<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    let outcome: Result<unknown>
    try {
      outcome = this.run()
    } catch (error) {
      outcome = { data: null, error: { message: String(error) } }
    }
    return delay(outcome).then(onfulfilled, onrejected)
  }
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/* ------------------------------------------------------------------ auth */

interface DemoSession {
  user: { id: string; email: string }
  access_token: string
}

type AuthCallback = (event: string, session: DemoSession | null) => void

const authCallbacks = new Set<AuthCallback>()
let currentSession: DemoSession | null = readStoredSession()

function readStoredSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoSession
    // Only trust it if that person still exists in the fixtures.
    return rowsOf('profiles').some((p) => p.id === parsed.user.id) ? parsed : null
  } catch {
    return null
  }
}

function writeSession(session: DemoSession | null) {
  currentSession = session
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private browsing can refuse writes. The session still works in memory.
  }
  for (const callback of authCallbacks) {
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session)
  }
}

function sessionFor(userId: string, email: string): DemoSession {
  return { user: { id: userId, email }, access_token: `demo-${userId}` }
}

const auth = {
  async getSession() {
    return delay({ data: { session: currentSession }, error: null })
  },

  onAuthStateChange(callback: AuthCallback) {
    authCallbacks.add(callback)
    return {
      data: {
        subscription: {
          unsubscribe() {
            authCallbacks.delete(callback)
          },
        },
      },
    }
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await delay(null)
    const userId = emailIndex.get(email.trim().toLowerCase())

    if (!userId) {
      return {
        data: { user: null, session: null },
        error: { message: 'No account with that email. Use one of the demo accounts below.' },
      }
    }
    if (password !== 'password123') {
      return {
        data: { user: null, session: null },
        error: { message: 'Wrong password. Every demo account uses password123.' },
      }
    }

    const session = sessionFor(userId, email)
    writeSession(session)
    return { data: { user: session.user, session }, error: null }
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string
    password: string
    options?: { data?: { full_name?: string; role?: AppRole } }
  }) {
    await delay(null)
    if (password.length < 6) {
      return { data: { user: null, session: null }, error: { message: 'Password must be at least 6 characters.' } }
    }

    const normalized = email.trim().toLowerCase()
    if (emailIndex.has(normalized)) {
      return {
        data: { user: null, session: null },
        error: { message: 'That email is already registered.' },
      }
    }

    const id = uuid()
    const role = options?.data?.role ?? 'student'

    rowsOf('profiles').push({
      id,
      full_name: options?.data?.full_name ?? 'New user',
      role,
      bio: null,
      avatar_url: null,
      subjects: [],
      is_verified: false,
      is_suspended: false,
      created_at: new Date().toISOString(),
    })
    rowsOf('user_roles').push({ id: uuid(), user_id: id, role })
    emailIndex.set(normalized, id)

    const session = sessionFor(id, email)
    writeSession(session)
    return { data: { user: session.user, session }, error: null }
  },

  async signOut() {
    writeSession(null)
    return { error: null }
  },
}

/* -------------------------------------------------------------- channels */

class DemoChannel {
  private own: Listener[] = []

  constructor(public topic: string) {}

  on(
    _event: string,
    config: { event?: string; table?: string; filter?: string },
    handler: ChangeHandler
  ) {
    let filterColumn: string | undefined
    let filterValue: string | undefined

    if (config.filter) {
      const parsed = config.filter.match(/^(\w+)=eq\.(.+)$/)
      if (parsed) {
        filterColumn = parsed[1]
        filterValue = parsed[2]
      }
    }

    const listener: Listener = {
      table: config.table ?? '',
      event: config.event ?? '*',
      filterColumn,
      filterValue,
      handler,
    }

    listeners.add(listener)
    this.own.push(listener)
    return this
  }

  subscribe(callback?: (status: string) => void) {
    if (callback) setTimeout(() => callback('SUBSCRIBED'), 60)
    return this
  }

  teardown() {
    for (const listener of this.own) listeners.delete(listener)
    this.own = []
  }
}

/* ------------------------------------------------------------------ client */

export const demoClient = {
  from(table: Table | string) {
    return new QueryBuilder(String(table))
  },
  auth,
  channel(topic: string) {
    return new DemoChannel(topic)
  },
  removeChannel(channel: DemoChannel) {
    channel.teardown()
    return Promise.resolve('ok')
  },
}

/** Signs straight in as one of the seeded people, for the one-click buttons. */
export async function demoSignIn(userId: string, email: string) {
  await delay(null)
  writeSession(sessionFor(userId, email))
}

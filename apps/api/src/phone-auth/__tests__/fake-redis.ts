type Entry = { value: string | Map<string, string>; expiresAt: number | null };

/**
 * Minimal in-memory stand-in for the node-redis commands used by PhoneOtpService.
 * Expiry follows Date.now(), so jest fake timers / setSystemTime control TTLs.
 */
export class FakeRedis {
  private store = new Map<string, Entry>();

  private read(key: string): Entry | undefined {
    const entry = this.store.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  async set(key: string, value: string, options?: { NX?: boolean; EX?: number }) {
    if (options?.NX && this.read(key)) return null;

    this.store.set(key, {
      value,
      expiresAt: options?.EX ? Date.now() + options.EX * 1000 : null,
    });

    return "OK";
  }

  async get(key: string) {
    const entry = this.read(key);
    return typeof entry?.value === "string" ? entry.value : null;
  }

  async ttl(key: string) {
    const entry = this.read(key);

    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;

    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async incr(key: string) {
    const entry = this.read(key);
    const next = Number(typeof entry?.value === "string" ? entry.value : 0) + 1;

    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });

    return next;
  }

  async expire(key: string, seconds: number) {
    const entry = this.read(key);

    if (!entry) return false;

    entry.expiresAt = Date.now() + seconds * 1000;

    return true;
  }

  async del(key: string) {
    const existed = Boolean(this.read(key));
    this.store.delete(key);

    return existed ? 1 : 0;
  }

  async hSet(key: string, fields: Record<string, string>) {
    const entry = this.read(key);
    const hash = entry?.value instanceof Map ? entry.value : new Map<string, string>();

    for (const [field, value] of Object.entries(fields)) hash.set(field, value);

    this.store.set(key, { value: hash, expiresAt: entry?.expiresAt ?? null });

    return Object.keys(fields).length;
  }

  async hGet(key: string, field: string) {
    const entry = this.read(key);

    return entry?.value instanceof Map ? (entry.value.get(field) ?? null) : null;
  }

  async hIncrBy(key: string, field: string, increment: number) {
    const entry = this.read(key);
    const hash = entry?.value instanceof Map ? entry.value : new Map<string, string>();
    const next = Number(hash.get(field) ?? 0) + increment;

    hash.set(field, String(next));
    this.store.set(key, { value: hash, expiresAt: entry?.expiresAt ?? null });

    return next;
  }

  multi() {
    const operations: Array<() => Promise<unknown>> = [];

    const chain = {
      del: (key: string) => {
        operations.push(() => this.del(key));
        return chain;
      },
      hSet: (key: string, fields: Record<string, string>) => {
        operations.push(() => this.hSet(key, fields));
        return chain;
      },
      expire: (key: string, seconds: number) => {
        operations.push(() => this.expire(key, seconds));
        return chain;
      },
      exec: async () => {
        const results: unknown[] = [];

        for (const operation of operations) results.push(await operation());

        return results;
      },
    };

    return chain;
  }

  keys() {
    return [...this.store.keys()].filter((key) => this.read(key));
  }

  rawValues() {
    return [...this.store.values()].map((entry) =>
      entry.value instanceof Map ? Object.fromEntries(entry.value) : entry.value,
    );
  }
}

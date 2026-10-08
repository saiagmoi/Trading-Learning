type Entry<T> = { exp: number; data: T };

const store = new Map<string, Entry<unknown>>();

export function cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.data as T);
  return factory().then((data) => {
    store.set(key, { exp: Date.now() + ttlMs, data });
    return data;
  });
}

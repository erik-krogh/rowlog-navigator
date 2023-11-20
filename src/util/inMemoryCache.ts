
interface CacheEntry<T> {
  value: T;
  expiration: number;
}

export function createInMemoryCache<T>(expirationTimeMs: number) {
  const cache: Record<string, CacheEntry<Promise<T>>> = {};

  async function get(key: string): Promise<T | undefined> {
    const entry = cache[key];
    if (entry && entry.expiration > Date.now()) {
      return await entry.value;
    }
    delete cache[key];
    return undefined;
  }

  function set(key: string, value: Promise<T>): void {
    cache[key] = {
      value,
      expiration: Date.now() + expirationTimeMs,
    };
  }

  async function getOrSet(key: string, setter: () => Promise<T>): Promise<T> {
    const cachedValue = await get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    const value = setter();
    set(key, value);
    return await value;
  }

  return {
    get,
    set,
    getOrSet,
  };
}

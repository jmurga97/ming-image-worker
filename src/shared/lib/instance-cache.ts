export function getOrCreateInstance<Key extends object, Value>(
  cache: WeakMap<Key, Value>,
  key: Key,
  create: () => Value,
): Value {
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const value = create();
  cache.set(key, value);
  return value;
}

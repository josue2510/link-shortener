const DEFAULT_MAX_SIZE = 50;

export class LruCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);

    if (value === undefined) {
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.entries.delete(key);
    this.entries.set(key, value);

    return value;
  }

  set(key: string, value: T): void {
    // If key already exists, delete it first so it moves to the end
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, value);

    // Evict the oldest entry (first in Map) if over capacity
    if (this.entries.size > this.maxSize) {
      const oldestKey = this.entries.keys().next().value as string;
      this.entries.delete(oldestKey);
    }
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

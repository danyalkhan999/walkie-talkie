// ==========================================
// Storage Utility Wrappers
// ==========================================

/**
 * Safely retrieves and parses an item from LocalStorage.
 */
export function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultValue;
    }
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  } catch (error) {
    console.warn(`[StorageUtils] Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely serializes and saves an item to LocalStorage.
 */
export function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
  } catch (error) {
    console.warn(`[StorageUtils] Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Safely removes an item from LocalStorage.
 */
export function removeLocalStorageItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[StorageUtils] Error removing localStorage key "${key}":`, error);
  }
}

/**
 * Safely retrieves and parses an item from SessionStorage.
 */
export function getSessionStorageItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return defaultValue;
    }
    const item = window.sessionStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  } catch (error) {
    console.warn(`[StorageUtils] Error reading sessionStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely serializes and saves an item to SessionStorage.
 */
export function setSessionStorageItem<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    window.sessionStorage.setItem(key, serialized);
  } catch (error) {
    console.warn(`[StorageUtils] Error setting sessionStorage key "${key}":`, error);
  }
}

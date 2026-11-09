export const CLIENT_AUTH_FLAG_KEY = 'aman_auth';

export interface ClientAuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

export function readCachedLoginFlag(storage: ClientAuthStorage | null | undefined = getBrowserStorage()): boolean {
  try {
    return storage?.getItem(CLIENT_AUTH_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function syncCachedLoginFlag(
  storage: ClientAuthStorage | null | undefined = getBrowserStorage(),
  loggedIn: boolean
): void {
  try {
    if (loggedIn) {
      storage?.setItem(CLIENT_AUTH_FLAG_KEY, '1');
    } else {
      storage?.removeItem(CLIENT_AUTH_FLAG_KEY);
    }
  } catch {
    /* ignore unavailable browser storage */
  }
}

export async function fetchSessionLoginFlag(fetcher: typeof fetch = fetch): Promise<boolean> {
  const response = await fetcher('/api/v1/auth/me');
  const data = await response.json().catch(() => null);
  return hasCurrentUser(data);
}

function hasCurrentUser(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'user' in data && Boolean(data.user);
}

function getBrowserStorage(): ClientAuthStorage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.localStorage;
}

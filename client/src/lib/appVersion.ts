const VERSION_KEY = 'flipsync_app_version';

export function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredVersion(version: string): void {
  try {
    localStorage.setItem(VERSION_KEY, version);
  } catch {
    // Ignore localStorage errors
  }
}

export function clearStoredVersion(): void {
  try {
    localStorage.removeItem(VERSION_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

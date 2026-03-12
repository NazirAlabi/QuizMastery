// Centralized Gemini API key handling.
// Supports environment variables and a localStorage fallback for user-provided keys.

const LOCAL_STORAGE_KEY = "gemini_api_key";

function getEnvApiKey() {
  const viteKey =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_GEMINI_KEY
      ? import.meta.env.VITE_GEMINI_KEY
      : null;

  const craKey =
    typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_GEMINI_KEY
      ? process.env.REACT_APP_GEMINI_KEY
      : null;

  return viteKey || craKey || null;
}

function getUserApiKey() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored && stored.trim() ? stored.trim() : null;
  } catch (error) {
    return null;
  }
}

export function getApiKey() {
  return getEnvApiKey() || getUserApiKey();
}

export function setUserApiKey(key) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  if (typeof key !== "string" || !key.trim()) {
    return false;
  }

  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
    return true;
  } catch (error) {
    return false;
  }
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

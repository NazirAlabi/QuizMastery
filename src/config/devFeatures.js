const DEV_STORAGE_KEY = 'quizmaster_dev_access_v1';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const parseEmailList = (value) =>
  String(value || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

const DEV_ACCESS_EMAILS = parseEmailList(import.meta.env.VITE_DEV_FEATURE_EMAILS);
const DEV_ACCESS_PASSWORD = String(import.meta.env.VITE_DEV_FEATURE_PASSWORD || '');
const DEV_AUTH_EMAIL = normalizeEmail(import.meta.env.VITE_DEV_AUTH_EMAIL);
const DEV_AUTH_PASSWORD = String(import.meta.env.VITE_DEV_AUTH_PASSWORD || '');

export const isDevFeatureConfigEnabled =
  DEV_ACCESS_EMAILS.length > 0 && DEV_ACCESS_PASSWORD.length > 0;

export const isDevEmailAllowed = (email) =>
  DEV_ACCESS_EMAILS.includes(normalizeEmail(email));

export const isDevCredentialMatch = (email, password) => {
  if (!isDevFeatureConfigEnabled) return false;
  return (
    isDevEmailAllowed(email) &&
    String(password || '') === DEV_ACCESS_PASSWORD
  );
};

export const getResolvedAuthCredentials = (email, password) => {
  if (
    isDevCredentialMatch(email, password) &&
    DEV_AUTH_EMAIL &&
    DEV_AUTH_PASSWORD
  ) {
    return {
      email: DEV_AUTH_EMAIL,
      password: DEV_AUTH_PASSWORD,
    };
  }

  return {
    email: String(email || '').trim(),
    password: String(password || ''),
  };
};

export const readDevAccessSession = () => {
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      enabled: Boolean(parsed.enabled),
      email: normalizeEmail(parsed.email),
      uid: String(parsed.uid || ''),
    };
  } catch {
    return null;
  }
};

export const writeDevAccessSession = ({ enabled, email, uid }) => {
  localStorage.setItem(
    DEV_STORAGE_KEY,
    JSON.stringify({
      enabled: Boolean(enabled),
      email: normalizeEmail(email),
      uid: String(uid || ''),
    })
  );
};

export const clearDevAccessSession = () => {
  localStorage.removeItem(DEV_STORAGE_KEY);
};

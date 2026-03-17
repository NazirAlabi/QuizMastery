const PERMISSION_PATTERNS = ['permission-denied', 'missing or insufficient permissions'];

const toLowerText = (value) => String(value || '').toLowerCase();

export const isFirestorePermissionError = (error) => {
  const combined = `${toLowerText(error?.code)} ${toLowerText(error?.message)}`;
  return PERMISSION_PATTERNS.some((pattern) => combined.includes(pattern));
};

export const isUnexpectedFirestoreResponse = (value, expected = 'array') => {
  if (expected === 'array') return !Array.isArray(value);
  if (expected === 'object') return value === null || typeof value !== 'object' || Array.isArray(value);
  return value === undefined || value === null;
};

export const logFirestoreQueryError = (context, error, details = {}) => {
  const code = String(error?.code || 'unknown');
  const message = String(error?.message || error || 'Unknown Firestore error');
  const type = isFirestorePermissionError(error) ? 'permission' : 'query';

  console.error(`[firestore:${type}] ${context}`, {
    code,
    message,
    ...details,
  });
};

export const logUnexpectedFirestoreResponse = (context, expected, actual, details = {}) => {
  console.error(`[firestore:unexpected-response] ${context}`, {
    expected,
    actualType: Array.isArray(actual) ? 'array' : typeof actual,
    actual,
    ...details,
  });
};

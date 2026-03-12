const safeDecode = (value) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value);
  }
};

export const resolveReturnUrl = (rawReturnUrl, fallback = '/courses') => {
  const decoded = safeDecode(rawReturnUrl);
  if (!decoded || !decoded.startsWith('/') || decoded.startsWith('//')) {
    return fallback;
  }
  return decoded;
};

export const appendReturnUrl = (basePath, returnUrl) => {
  if (!returnUrl) return basePath;
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}returnUrl=${encodeURIComponent(returnUrl)}`;
};

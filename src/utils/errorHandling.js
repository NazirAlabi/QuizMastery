/**
 * Maps raw error objects or message strings (like Firebase error codes) 
 * into user-friendly, actionable error messages for display in the UI.
 *
 * @param {Error|string} error - The error object caught in a try/catch or a string code
 * @param {string} fallbackMessage - Optional default message if the error is entirely unknown
 * @returns {string} - A human-readable error description
 */
export const getUserFriendlyErrorMessage = (error, fallbackMessage = 'An unexpected error occurred. Please try again.') => {
  if (!error) return fallbackMessage;

  // Extract the inner message or code if it's an Error object
  const errorMessage = typeof error === 'string' 
    ? error 
    : String(error?.code || error?.message || error?.name || '').toLowerCase();

  // Network and Connectivity Errors
  if (
    errorMessage.includes('network error') ||
    errorMessage.includes('network-request-failed') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('disconnected') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('unavailable')
  ) {
    return 'Network connection lost. Please check your internet and try again.';
  }

  // Authentication Errors
  if (errorMessage.includes('auth/invalid-credential') || errorMessage.includes('auth/wrong-password') || errorMessage.includes('auth/user-not-found')) {
    return 'Invalid email or password. Please try again.';
  }
  if (errorMessage.includes('auth/email-already-in-use')) {
    return 'That email address is already registered to another account.';
  }
  if (errorMessage.includes('auth/weak-password')) {
    return 'Your password is too weak. Please use at least 6 characters.';
  }
  if (errorMessage.includes('auth/too-many-requests')) {
    return 'Too many secure requests. Please wait a moment and try again.';
  }
  if (errorMessage.includes('auth/requires-recent-login')) {
    return 'For your security, please log out and log back in to perform this action.';
  }
  
  // Database / Firestore Errors
  if (errorMessage.includes('permission-denied') || errorMessage.includes('missing or insufficient permissions')) {
    return 'You do not have permission to access or modify this data.';
  }
  if (errorMessage.includes('not-found') || errorMessage.includes('no document to update')) {
    return 'The requested record could not be found.';
  }
  if (errorMessage.includes('quota-exceeded')) {
    return 'Service quota exceeded. Please try again later.';
  }

  // Application-specific business logic errors (from custom API codes if any)
  if (errorMessage.includes('guest-attempt-limit')) {
    return 'Guest attempts limit reached. Please register an account.';
  }

  // Handle JS formatting or syntax errors
  if (errorMessage.includes('syntaxerror: expected') || errorMessage.includes('json at position')) {
      return 'The provided data is formatted incorrectly.';
  }

  // Return the original message if it's short and seems okay, otherwise fallback
  if (typeof error === 'string' && error.length < 50 && !error.includes('auth/')) {
      return error;
  }
  
  if (error instanceof Error && error.message && error.message.length < 50 && !error.message.includes('auth/')) {
     return error.message;
  }

  return fallbackMessage;
};

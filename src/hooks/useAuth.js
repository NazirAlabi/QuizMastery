import { createContext, useCallback, useContext, useState, useEffect, createElement, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/client.js';
import {
  createGuest as apiCreateGuest,
  login as apiLogin,
  logout as apiLogout,
  requestPasswordReset as apiRequestPasswordReset,
  register as apiRegister,
  resolveSessionUser,
  updateUserDisplayName as apiUpdateUserDisplayName,
} from '@/api/api.js';
import {
  clearDevAccessSession,
  getResolvedAuthCredentials,
  isDevEmailAllowed,
  isDevFeatureConfigEnabled,
  isDevCredentialMatch,
  readDevAccessSession,
  writeDevAccessSession,
} from '@/config/devFeatures.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

const AUTH_CONTEXT_KEY = '__UQM_AUTH_CONTEXT__';

const AuthContext = (() => {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis[AUTH_CONTEXT_KEY]) {
      globalThis[AUTH_CONTEXT_KEY] = createContext(null);
    }
    return globalThis[AUTH_CONTEXT_KEY];
  }
  return createContext(null);
})();

const LEGACY_GUEST_ID_COOKIE = 'qm_guest_id';
const LEGACY_GUEST_AUTH_KEY = 'qm_guest_auth_v1';
const AUTH_UI_CACHE_KEY = 'quizmaster_auth_ui_cache_v1';
const AUTH_PERSISTENCE_PREF_KEY = 'quizmaster_auth_persistence_pref_v1';

const readAuthUiCache = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_UI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.user || typeof parsed.user !== 'object') return null;

    return {
      user: parsed.user,
      token: parsed.token || null,
      isAuthenticated: Boolean(parsed.isAuthenticated),
    };
  } catch {
    return null;
  }
};

const writeAuthUiCache = ({ user, token, isAuthenticated }) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    AUTH_UI_CACHE_KEY,
    JSON.stringify({
      user: user || null,
      token: token || null,
      isAuthenticated: Boolean(isAuthenticated),
    })
  );
};

const clearAuthUiCache = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_UI_CACHE_KEY);
};

const writePersistencePreference = (staySignedIn) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    AUTH_PERSISTENCE_PREF_KEY,
    staySignedIn ? 'local' : 'session'
  );
};

const clearLegacyGuestArtifacts = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    window.localStorage.removeItem(LEGACY_GUEST_AUTH_KEY);
  } catch {
    // no-op
  }

  try {
    document.cookie = `${encodeURIComponent(LEGACY_GUEST_ID_COOKIE)}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // no-op
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readAuthUiCache()?.user || null);
  const [token, setToken] = useState(() => readAuthUiCache()?.token || null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(readAuthUiCache()?.isAuthenticated));
  const [isLoading, setIsLoading] = useState(true);
  const [isDevFeaturesEnabled, setIsDevFeaturesEnabled] = useState(false);
  const [canToggleDevFeatures, setCanToggleDevFeatures] = useState(false);

  useEffect(() => {
    clearLegacyGuestArtifacts();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setIsDevFeaturesEnabled(false);
        setCanToggleDevFeatures(false);
        clearAuthUiCache();
        setIsLoading(false);
        return;
      }

      try {
        const nextToken = await firebaseUser.getIdToken();
        const sessionUser = await resolveSessionUser(firebaseUser);
        setToken(nextToken);
        setUser(sessionUser);
        setIsAuthenticated(true);
        writeAuthUiCache({ user: sessionUser, token: nextToken, isAuthenticated: true });

        if (sessionUser.isGuest) {
          setCanToggleDevFeatures(false);
          setIsDevFeaturesEnabled(false);
          setIsLoading(false);
          return;
        }

        const savedSession = readDevAccessSession();
        const hasMatchingDevSession =
          Boolean(savedSession?.uid) &&
          savedSession.uid === sessionUser.uid;
        const devSessionEmail = savedSession?.email || sessionUser.email || '';
        const hasDevAccess =
          hasMatchingDevSession &&
          isDevFeatureConfigEnabled &&
          isDevEmailAllowed(devSessionEmail);
        setCanToggleDevFeatures(hasDevAccess);
        setIsDevFeaturesEnabled(hasDevAccess && Boolean(savedSession?.enabled));
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setIsDevFeaturesEnabled(false);
        setCanToggleDevFeatures(false);
        clearAuthUiCache();
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password, { staySignedIn = true } = {}) => {
    try {
      const authCredentials = getResolvedAuthCredentials(email, password);
      const persistence = staySignedIn ? 'local' : 'session';
      writePersistencePreference(staySignedIn);
      const response = await apiLogin(authCredentials.email, authCredentials.password, {
        persistence,
      });
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);
      writeAuthUiCache({ user: response.user, token: response.token, isAuthenticated: true });
      clearDevAccessSession();
      const devEnabled = isDevCredentialMatch(email, password);
      writeDevAccessSession({ enabled: devEnabled, email, uid: response.user.uid });
      setIsDevFeaturesEnabled(devEnabled);
      setCanToggleDevFeatures(isDevFeatureConfigEnabled && isDevEmailAllowed(email));

      return { success: true };
    } catch (error) {
      logFirestoreQueryError('auth:login', error, { email });
      return { success: false, error: error.message };
    }
  }, []);

  const register = useCallback(async (email, password, displayName = '', { staySignedIn = true } = {}) => {
    try {
      const persistence = staySignedIn ? 'local' : 'session';
      writePersistencePreference(staySignedIn);
      const response = await apiRegister(email, password, displayName, { persistence });
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);
      writeAuthUiCache({ user: response.user, token: response.token, isAuthenticated: true });
      clearDevAccessSession();
      writeDevAccessSession({ enabled: false, email, uid: response.user.uid });
      setIsDevFeaturesEnabled(false);
      setCanToggleDevFeatures(false);

      return { success: true };
    } catch (error) {
      logFirestoreQueryError('auth:register', error, { email });
      return { success: false, error: error.message };
    }
  }, []);

  const createGuest = useCallback(async (displayName) => {
    try {
      const response = await apiCreateGuest(displayName);

      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);
      writeAuthUiCache({ user: response.user, token: response.token, isAuthenticated: true });
      setIsDevFeaturesEnabled(false);
      setCanToggleDevFeatures(false);
      clearDevAccessSession();

      return { success: true };
    } catch (error) {
      logFirestoreQueryError('auth:createGuest', error);
      return { success: false, error: error.message };
    }
  }, []);

  const updateUserDisplayName = useCallback(async (displayName) => {
    try {
      const updatedUser = await apiUpdateUserDisplayName(displayName);
      setUser((previous) => ({
        ...previous,
        ...updatedUser,
      }));
      writeAuthUiCache({
        user: {
          ...(user || {}),
          ...updatedUser,
        },
        token,
        isAuthenticated: true,
      });
      return { success: true };
    } catch (error) {
      logFirestoreQueryError('auth:updateUserDisplayName', error, { userId: user?.uid || user?.id });
      return { success: false, error: error.message };
    }
  }, [token, user]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setIsDevFeaturesEnabled(false);
      setCanToggleDevFeatures(false);
      clearDevAccessSession();
      clearAuthUiCache();
    }
  }, []);

  const requestPasswordReset = useCallback(async (email, displayName) => {
    try {
      await apiRequestPasswordReset({ email, displayName });
      return { success: true };
    } catch (error) {
      logFirestoreQueryError('auth:requestPasswordReset', error, { email });
      return { success: false, error: error.message };
    }
  }, []);

  const toggleDevFeatures = useCallback(() => {
    if (!canToggleDevFeatures || !user?.uid) return;

    const currentSession = readDevAccessSession();
    const nextEnabled = !isDevFeaturesEnabled;
    writeDevAccessSession({
      enabled: nextEnabled,
      email: currentSession?.email || user.email || '',
      uid: user.uid,
    });
    setIsDevFeaturesEnabled(nextEnabled);
  }, [canToggleDevFeatures, isDevFeaturesEnabled, user?.email, user?.uid]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      isDevFeaturesEnabled,
      isGuestUser: Boolean(user?.isGuest),
      canToggleDevFeatures,
      toggleDevFeatures,
      login,
      register,
      requestPasswordReset,
      createGuest,
      updateUserDisplayName,
      logout,
    }),
    [
      canToggleDevFeatures,
      createGuest,
      isAuthenticated,
      isDevFeaturesEnabled,
      isLoading,
      login,
      logout,
      register,
      requestPasswordReset,
      toggleDevFeatures,
      token,
      updateUserDisplayName,
      user,
    ]
  );

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

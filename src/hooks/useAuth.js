import { createContext, useContext, useState, useEffect, createElement } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/firebase/client.js';
import { db } from '@/firebase/client.js';
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
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

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevFeaturesEnabled, setIsDevFeaturesEnabled] = useState(false);
  const [canToggleDevFeatures, setCanToggleDevFeatures] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setIsDevFeaturesEnabled(false);
        setCanToggleDevFeatures(false);
        setIsLoading(false);
        return;
      }

      try {
        const nextToken = await firebaseUser.getIdToken();
        const userSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userSnapshot.exists() ? userSnapshot.data() : {};
        setToken(nextToken);
        setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName:
            userData.displayName ||
            firebaseUser.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Quiz User',
          profilePhotoUrl: firebaseUser.photoURL || null,
        });
        setIsAuthenticated(true);

        const savedSession = readDevAccessSession();
        const hasMatchingDevSession =
          Boolean(savedSession?.uid) &&
          savedSession.uid === firebaseUser.uid;
        const devSessionEmail = savedSession?.email || firebaseUser.email || '';
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
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const authCredentials = getResolvedAuthCredentials(email, password);
      const response = await apiLogin(authCredentials.email, authCredentials.password);
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);
      const devEnabled = isDevCredentialMatch(email, password);
      writeDevAccessSession({ enabled: devEnabled, email, uid: response.user.uid });
      setIsDevFeaturesEnabled(devEnabled);
      setCanToggleDevFeatures(isDevFeatureConfigEnabled && isDevEmailAllowed(email));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, displayName = '') => {
    try {
      const response = await apiRegister(email, password, displayName);
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);
      writeDevAccessSession({ enabled: false, email, uid: response.user.uid });
      setIsDevFeaturesEnabled(false);
      setCanToggleDevFeatures(false);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateUserDisplayName = async (displayName) => {
    try {
      const updatedUser = await apiUpdateUserDisplayName(displayName);
      setUser((previous) => ({
        ...previous,
        ...updatedUser,
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setIsDevFeaturesEnabled(false);
      setCanToggleDevFeatures(false);
      clearDevAccessSession();
    }
  };

  const toggleDevFeatures = () => {
    if (!canToggleDevFeatures || !user?.uid) return;

    const currentSession = readDevAccessSession();
    const nextEnabled = !isDevFeaturesEnabled;
    writeDevAccessSession({
      enabled: nextEnabled,
      email: currentSession?.email || user.email || '',
      uid: user.uid,
    });
    setIsDevFeaturesEnabled(nextEnabled);
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    isDevFeaturesEnabled,
    canToggleDevFeatures,
    toggleDevFeatures,
    login,
    register,
    updateUserDisplayName,
    logout
  };

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

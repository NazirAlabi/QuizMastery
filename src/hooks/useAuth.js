import { createContext, useContext, useState, useEffect, createElement } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/client.js';
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '@/api/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const nextToken = await firebaseUser.getIdToken();
        setToken(nextToken);
        setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          profilePhotoUrl: firebaseUser.photoURL || null,
        });
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiLogin(email, password);
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await apiRegister(email, password);
      
      setUser(response.user);
      setToken(response.token);
      setIsAuthenticated(true);

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
    }
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
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

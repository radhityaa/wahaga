import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const API_KEY_STORAGE_KEY = 'wa_gateway_api_key';

export const AuthProvider = ({ children }) => {
  const [apiKey, setApiKeyState] = useState(localStorage.getItem(API_KEY_STORAGE_KEY) || '');
  
  // Always authenticated - security is at API level
  const isAuthenticated = true;
  const loading = false;

  const setApiKey = (key) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKeyState(key);
  };

  const logout = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKeyState('');
  };

  const value = {
    apiKey,
    loading,
    isAuthenticated,
    setApiKey,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

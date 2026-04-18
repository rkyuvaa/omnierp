import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext({ user: null, loading: true, login: async () => {}, logout: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // MATRIX PER-MODULE ROLE PARSER
  const fetchUserWithRole = async (userData) => {
    if (userData.is_superadmin) return { ...userData, module_permissions: { _super: true } };
    const permissionsMap = {};
    try {
      const rolesRes = await api.get('/roles/');
      const rolesList = rolesRes.data;
      const modAllocations = (Array.isArray(userData.allowed_modules) || !userData.allowed_modules) ? {} : userData.allowed_modules;
      Object.keys(modAllocations).forEach(mod => {
        const roleId = modAllocations[mod];
        const rDetails = rolesList.find(r => r.id === roleId);
        if (rDetails) permissionsMap[mod] = rDetails.permissions || {};
      });
    } catch (e) { console.error("Failed to map module roles", e); }
    return { ...userData, module_permissions: permissionsMap }; 
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me').then(async r => setUser(await fetchUserWithRole(r.data))).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const form = new FormData();
    form.append('username', email); form.append('password', password);
    const r = await api.post('/auth/login', form);
    localStorage.setItem('token', r.data.access_token);
    const me = await api.get('/auth/me');
    setUser(await fetchUserWithRole(me.data));
  };

  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

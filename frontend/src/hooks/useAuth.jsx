import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { resubscribeForCurrentUser, unsubscribeUser } from '../utils/pushNotifications';

const AuthContext = createContext({ user: null, loading: true, login: async () => {}, verifyMfa: async () => {}, logout: () => {} });

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

  const registerFcmTokenIfAny = async (retryCount = 0) => {
    const fcmToken = localStorage.getItem('kim_fcm_token') || window.KIM_FCM_TOKEN;
    if (fcmToken) {
      try {
        await api.post('/notifications/register-token', { token: fcmToken });
        console.log('✅ FCM token registered silently');
      } catch (e) {
        console.error('Failed to register FCM token silently:', e);
      }
    } else if (retryCount < 5) {
      // Android WebView token injection can happen slightly after page mount.
      // Retry every 2 seconds for up to 10 seconds.
      setTimeout(() => {
        registerFcmTokenIfAny(retryCount + 1);
      }, 2000);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(async r => {
          const userWithRole = await fetchUserWithRole(r.data);
          setUser(userWithRole);
          registerFcmTokenIfAny().catch(() => {});
          // Proactively ensure subscription is associated with current user on mount/refresh
          resubscribeForCurrentUser().catch(() => {});
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const form = new FormData();
    form.append('username', email); form.append('password', password);
    const r = await api.post('/auth/login', form);
    if (r.data.mfa_required) {
      return r.data;
    }
    localStorage.setItem('token', r.data.access_token);
    const me = await api.get('/auth/me');
    setUser(await fetchUserWithRole(me.data));
    registerFcmTokenIfAny().catch(() => {});
    // Re-associate any existing browser push subscription with this user so
    // notifications are delivered to the correct person on shared devices.
    resubscribeForCurrentUser().catch(() => {});
    return r.data;
  };

  const verifyMfa = async (mfa_token, code) => {
    const r = await api.post('/auth/verify-totp', { mfa_token, code });
    localStorage.setItem('token', r.data.access_token);
    const me = await api.get('/auth/me');
    setUser(await fetchUserWithRole(me.data));
    registerFcmTokenIfAny().catch(() => {});
    resubscribeForCurrentUser().catch(() => {});
    return r.data;
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      const me = await api.get('/auth/me');
      setUser(await fetchUserWithRole(me.data));
    }
  };

  const logout = async () => {
    // Detach browser push subscription from this user on the backend before
    // clearing the token, so notifications are no longer sent to this user.
    try { await unsubscribeUser(); } catch (_) {}
    localStorage.removeItem('token');
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, login, verifyMfa, logout, loading, refreshUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.getMe();
      setUser(user);

      // Claim pending invite
      const pendingInvite = localStorage.getItem('jh_invite_code');
      if (pendingInvite && user && !user.guest) {
        try {
          await api.claimInvite(pendingInvite);
          localStorage.removeItem('jh_invite_code');
          const { user: refreshed } = await api.getMe();
          setUser(refreshed);
        } catch {
          localStorage.removeItem('jh_invite_code');
        }
      }

      // Legacy referral
      const pendingRef = localStorage.getItem('jh-referral');
      if (pendingRef && user && !user.guest) {
        api.claimReferral(pendingRef).catch(() => {});
        localStorage.removeItem('jh-referral');
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Capture invite/referral from URL
    const hash = window.location.hash;
    const refMatch = hash.match(/ref=([A-Z0-9]+)/i);
    if (refMatch) {
      localStorage.setItem('jh-referral', refMatch[1].toUpperCase());
      window.location.hash = '';
    }
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      localStorage.setItem('jh_invite_code', invite.toUpperCase());
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }

    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

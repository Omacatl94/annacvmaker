import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';

export default function Waitlist() {
  const { logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClaim = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await api.claimInvite(trimmed);
      await refresh();
      navigate('/');
    } catch {
      setError(t('auth.waitlistError'));
      setTimeout(() => setError(null), 3000);
    }
    setLoading(false);
  }, [code, refresh, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <div className="waitlist-page">
      <div className="login-card">
        <img src="/img/mascot/empty.webp" alt="JH in attesa" className="waitlist-img" />
        <h2>{t('auth.waitlistTitle')}</h2>
        <p className="login-subtitle">{t('auth.waitlistText')}</p>
        <div className="waitlist-form">
          <input
            type="text"
            placeholder={t('auth.waitlistInput')}
            maxLength={8}
            className="waitlist-input"
            style={{ textTransform: 'uppercase' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={loading}
            onClick={handleClaim}
          >
            {loading ? '...' : t('auth.waitlistClaim')}
          </button>
          {error && <p className="waitlist-error">{error}</p>}
          <button className="btn-secondary" onClick={handleLogout}>
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}

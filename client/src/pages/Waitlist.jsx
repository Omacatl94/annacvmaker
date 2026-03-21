import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../strings';
import { useAuth } from '../hooks/useAuth';

export default function Waitlist() {
  const { logout } = useAuth();
  const navigate = useNavigate();

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
          <button className="btn-secondary" onClick={handleLogout}>
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}

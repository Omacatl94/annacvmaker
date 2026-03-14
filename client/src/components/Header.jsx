import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { api } from '../api';
import Icon from './Icon';
import PricingModal from './PricingModal';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  useEffect(() => {
    if (user && !user.guest) {
      api.getBalance().then(data => setBalance(data)).catch(() => {});
    }
  }, [user]);

  const tabs = [
    { path: '/', label: 'Il mio CV', guestOk: true },
    { path: '/genera', label: 'Genera CV', guestOk: true },
    { path: '/candidature', label: 'Candidature', guestOk: false },
  ];

  function renderCreditBadge() {
    if (!balance) return '...';
    if (balance.openBeta) {
      return Math.max(0, balance.dailyLimit - balance.dailyUsed) + balance.credits;
    }
    return balance.credits;
  }

  const creditClass = () => {
    if (!balance) return '';
    const total = balance.openBeta
      ? Math.max(0, balance.dailyLimit - balance.dailyUsed) + balance.credits
      : balance.credits;
    if (total <= 0) return 'empty';
    if (total <= (balance.openBeta ? 1 : 2)) return 'low';
    return '';
  };

  return (
    <header className="app-header">
      <h1 className="app-logo" onClick={() => navigate('/')}>JobHacker</h1>

      <nav className="app-tabs">
        {tabs.map(tab => {
          const disabled = !tab.guestOk && user?.guest;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) =>
                'tab-btn' + (isActive ? ' active' : '') + (disabled ? ' tab-locked' : '')
              }
              onClick={e => disabled && e.preventDefault()}
              title={disabled ? 'Accedi per sbloccare' : undefined}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="app-user-area">
        <button className="theme-toggle" title="Cambia tema" aria-label="Cambia tema" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>

        {user && !user.guest && (
          <button
            className={`credit-badge ${creditClass()}`}
            title="Crediti rimasti"
            aria-label="Crediti rimasti"
            onClick={() => setShowPricing(true)}
          >
            <Icon name="coins" size={14} /> {renderCreditBadge()}
          </button>
        )}

        {user && !user.guest && <NotificationBell />}

        <button
          className={'header-avatar' + (user?.role === 'admin' ? ' admin-dot' : '')}
          onClick={() => navigate(user?.guest ? '/' : '/account')}
          title={user?.guest ? 'Ospite' : (user?.name || user?.email)}
          aria-label="Account utente"
        >
          {user?.photo_path
            ? <img src={user.photo_path} alt="Avatar" />
            : (user?.name || 'U')[0].toUpperCase()
          }
        </button>
      </div>

      {showPricing && createPortal(
        <PricingModal onClose={() => setShowPricing(false)} />,
        document.body
      )}
    </header>
  );
}

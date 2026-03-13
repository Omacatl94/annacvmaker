import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { api } from '../api';
import Icon from './Icon';
import GiftNotification from './GiftNotification';
import PricingModal from './PricingModal';

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [showPricing, setShowPricing] = useState(false);
  const [gift, setGift] = useState(null);

  useEffect(() => {
    if (user && !user.guest) {
      api.getBalance().then(data => {
        setBalance(data);
        if (data.gift && data.gift.credits > 0) setGift(data.gift);
      }).catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const tabs = [
    { path: '/', label: 'Il mio CV', guestOk: true },
    { path: '/genera', label: 'Genera CV', guestOk: true },
    { path: '/candidature', label: 'Candidature', guestOk: false },
    { path: '/account', label: 'Account', guestOk: false },
    ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin', guestOk: false }] : []),
  ];

  function renderCreditBadge() {
    if (!balance) return '...';
    if (balance.openBeta) {
      const free = Math.max(0, balance.dailyLimit - balance.dailyUsed);
      return `${free}/${balance.dailyLimit}${balance.credits > 0 ? ` +${balance.credits}` : ''}`;
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
        <div className="header-avatar">
          {user?.photo_path
            ? <img src={user.photo_path} alt="Avatar" />
            : (user?.name || 'U')[0].toUpperCase()
          }
        </div>
        <span className="header-username">
          {user?.guest ? 'Ospite' : (user?.name || user?.email)}
        </span>

        <button className="theme-toggle" title="Cambia tema" onClick={toggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>

        <button className="btn-logout" onClick={handleLogout}>Esci</button>

        {user && !user.guest && (
          <button
            className={`credit-badge ${creditClass()}`}
            title="Crediti rimasti"
            onClick={() => setShowPricing(true)}
          >
            <Icon name="coins" size={14} /> {renderCreditBadge()}
          </button>
        )}
      </div>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      {gift && <GiftNotification gift={gift} onClose={() => setGift(null)} />}
    </header>
  );
}

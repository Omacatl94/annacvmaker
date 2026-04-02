import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import Icon from './Icon';
import GiftNotification from './GiftNotification';

const POLL_INTERVAL = 60_000;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const TYPE_ICONS = {
  invite_claimed: { icon: 'user-plus', color: 'var(--color-success, #00E676)' },
  invite_activated: { icon: 'check-circle', color: 'var(--color-success, #00E676)' },
  batch_reload: { icon: 'gift', color: 'var(--color-accent, #448AFF)' },
  referral_complete: { icon: 'trophy', color: '#FFD600' },
  credits_received: { icon: 'coins', color: 'var(--color-success, #00E676)' },
  credits_purchased: { icon: 'credit-card', color: '#448AFF' },
  feedback_rewarded: { icon: 'message-circle', color: 'var(--color-accent, #448AFF)' },
  welcome_activated: { icon: 'sparkles', color: '#FFD600' },
};

const GIFT_TYPES = new Set(['batch_reload', 'referral_complete']);

function getNotificationText(type, data) {
  const fn = t(`notifications.${type}`);
  return typeof fn === 'function' ? fn(data) : type;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [giftData, setGiftData] = useState(null);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);

      // Trigger GiftNotification for special events
      const giftNotif = (res.notifications || []).find(
        n => !n.readAt && GIFT_TYPES.has(n.type)
      );
      if (giftNotif) {
        setGiftData(giftNotif.type === 'batch_reload'
          ? { credits: 0, reason: `${giftNotif.data.newCodes} nuovi inviti sbloccati!` }
          : { credits: giftNotif.data.credits, reason: 'Tutti i tuoi inviti sono attivi!' });
      }
    } catch { /* silent */ }
  }, []);

  const pollCount = useCallback(async () => {
    try {
      const res = await api.getNotificationCount();
      const newCount = res.unreadCount || 0;
      setUnreadCount(prev => {
        if (newCount > prev) fetchNotifications();
        return newCount;
      });
    } catch { /* silent */ }
  }, [fetchNotifications]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(pollCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollCount]);

  // Mark all as read when dropdown opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      api.markNotificationsRead({ all: true }).catch(() => {});
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    }
  }, [open, unreadCount]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <>
      <div className="notification-bell-wrap" ref={ref}>
        <button className="notification-bell-btn" onClick={() => setOpen(o => !o)} aria-label="Notifiche">
          <Icon name="bell" size={20} />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {open && (
          <div className="notification-dropdown">
            <div className="notification-dropdown-header">{t('notifications.title')}</div>
            {notifications.length === 0 ? (
              <div className="notification-empty">{t('notifications.empty')}</div>
            ) : (
              <div className="notification-list">
                {notifications.map(n => {
                  const typeInfo = TYPE_ICONS[n.type] || { icon: 'bell', color: '#888' };
                  return (
                    <div key={n.id} className={`notification-item${n.readAt ? '' : ' unread'}`}>
                      <div className="notification-icon" style={{ color: typeInfo.color }}>
                        <Icon name={typeInfo.icon} size={16} />
                      </div>
                      <div className="notification-content">
                        <span className="notification-text">{getNotificationText(n.type, n.data)}</span>
                        <span className="notification-time">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {giftData && <GiftNotification gift={giftData} onClose={() => setGiftData(null)} />}
    </>
  );
}

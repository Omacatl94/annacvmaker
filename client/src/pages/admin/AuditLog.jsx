import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';

const ACTIONS = [
  '',
  'login_google',
  'login_linkedin',
  'login_guest',
  'register_google',
  'register_linkedin',
  'logout',
  'admin_credit_change',
  'admin_activate_waitlist',
  'waitlist_google',
  'waitlist_linkedin',
];

const ACTION_LABELS = {
  login_google: 'Login Google',
  login_linkedin: 'Login LinkedIn',
  login_guest: 'Login Ospite',
  register_google: 'Registrazione Google',
  register_linkedin: 'Registrazione LinkedIn',
  logout: 'Logout',
  admin_credit_change: 'Modifica Raccoin',
  admin_activate_waitlist: 'Attivazione waitlist',
  admin_activate_user: 'Attivazione utente',
  waitlist_google: 'Waitlist Google',
  waitlist_linkedin: 'Waitlist LinkedIn',
  admin_waitlist_invite: 'Invito waitlist',
  admin_invite_generate: 'Invito generato',
  gdpr_export: 'Export GDPR',
  account_delete: 'Eliminazione account',
};

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = useCallback(async (actionFilter) => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.adminAudit(params);
      setLogs(res.logs);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAudit('');
  }, [loadAudit]);

  const handleActionChange = (e) => {
    const val = e.target.value;
    setAction(val);
    loadAudit(val);
  };

  return (
    <>
      <div className="admin-controls">
        <select className="admin-filter-select" value={action} onChange={handleActionChange}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a ? ACTION_LABELS[a] || a : 'Tutte le azioni'}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="user-cards-loading">Caricamento...</div>
      ) : logs.length === 0 ? (
        <div className="user-cards-loading">Nessun log.</div>
      ) : (
        <div className="user-cards">
          {logs.map((log, i) => (
            <AuditCard key={i} log={log} />
          ))}
        </div>
      )}
    </>
  );
}

function AuditCard({ log }) {
  const date = new Date(log.created_at).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const label = ACTION_LABELS[log.action] || log.action;
  const user = log.user_email || log.user_name || (log.user_id ? log.user_id.slice(0, 8) : null);

  return (
    <div className="audit-card">
      <div className="audit-card-top">
        <span className="audit-card-action">{label}</span>
        <span className="audit-card-date">{date}</span>
      </div>
      {user && <div className="audit-card-user">{user}</div>}
      {log.ip && <div className="audit-card-ip">{log.ip}</div>}
    </div>
  );
}

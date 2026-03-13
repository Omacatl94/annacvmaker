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
];

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
              {a || 'Tutte le azioni'}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-table-wrap">
        {loading ? (
          'Caricamento...'
        ) : logs.length === 0 ? (
          'Nessun log.'
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {['Data', 'Utente', 'Azione', 'IP'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td>{new Date(log.created_at).toLocaleString('it-IT')}</td>
                  <td>{log.user_email || log.user_id?.slice(0, 8) || '-'}</td>
                  <td>{log.action}</td>
                  <td>{log.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

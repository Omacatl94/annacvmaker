import { useState } from 'react';
import Dashboard from './admin/Dashboard';
import Users from './admin/Users';
import WaitlistPanel from './admin/WaitlistPanel';
import AuditLog from './admin/AuditLog';
import ErrorLog from './admin/ErrorLog';

const PANELS = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'users', label: 'Utenti', Component: Users },
  { id: 'waitlist', label: 'Waitlist', Component: WaitlistPanel },
  { id: 'audit', label: 'Audit Log', Component: AuditLog },
  { id: 'errors', label: 'Errori', Component: ErrorLog },
];

export default function Admin() {
  const [activePanel, setActivePanel] = useState('dashboard');

  const current = PANELS.find((p) => p.id === activePanel);
  const ActiveComponent = current?.Component || Dashboard;

  return (
    <div className="admin-page">
      <nav className="admin-nav">
        {PANELS.map((p) => (
          <button
            key={p.id}
            className={`admin-tab-btn${activePanel === p.id ? ' active' : ''}`}
            onClick={() => setActivePanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="admin-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

import { useState } from 'react';
import Icon from '../components/Icon';
import Dashboard from './admin/Dashboard';
import Users from './admin/Users';
import WaitlistPanel from './admin/WaitlistPanel';
import AuditLog from './admin/AuditLog';
import ErrorLog from './admin/ErrorLog';
import FeedbackPanel from './admin/FeedbackPanel';

const PANEL_GROUPS = [
  {
    panels: [
      { id: 'dashboard', label: 'Home', icon: 'layout-grid', Component: Dashboard },
    ],
  },
  {
    label: 'Utenti',
    panels: [
      { id: 'users', label: 'Utenti', icon: 'users', Component: Users },
      { id: 'waitlist', label: 'Waitlist', icon: 'clock', Component: WaitlistPanel },
    ],
  },
  {
    panels: [
      { id: 'feedback', label: 'Feedback', icon: 'message-circle', Component: FeedbackPanel },
    ],
  },
  {
    label: 'Sistema',
    panels: [
      { id: 'audit', label: 'Audit', icon: 'file-text', Component: AuditLog },
      { id: 'errors', label: 'Errori', icon: 'alert-triangle', Component: ErrorLog },
    ],
  },
];

const ALL_PANELS = PANEL_GROUPS.flatMap((g) => g.panels);

export default function Admin() {
  const [activePanel, setActivePanel] = useState('dashboard');

  const current = ALL_PANELS.find((p) => p.id === activePanel);
  const ActiveComponent = current?.Component || Dashboard;

  return (
    <div className="admin-page">
      <nav className="admin-nav">
        {PANEL_GROUPS.map((group, gi) => (
          <div key={gi} className="admin-tab-group">
            {group.panels.map((p) => (
              <button
                key={p.id}
                className={`admin-tab-btn${activePanel === p.id ? ' active' : ''}`}
                onClick={() => setActivePanel(p.id)}
              >
                <Icon name={p.icon} size={16} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="admin-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

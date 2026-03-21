import { useNavigate } from 'react-router-dom';

export default function ProfileSummary({ formData }) {
  const navigate = useNavigate();

  const recentExp = formData.experiences?.find((e) => e.role && e.role.trim());
  const expCount = formData.experiences?.filter((e) => e.role && e.role.trim()).length || 0;
  const skillCount = formData.skills?.length || 0;

  return (
    <div className="profile-summary card">
      <div className="profile-summary-info">
        <strong>{formData.personal?.name || 'Profilo'}</strong>
        {recentExp && (
          <span className="profile-summary-role">
            {recentExp.role}
            {recentExp.company ? ' @ ' + recentExp.company : ''}
          </span>
        )}
        <span className="profile-summary-stats">
          {expCount} esperienze &middot; {skillCount} competenze
        </span>
      </div>

      <button className="btn-secondary btn-sm" onClick={() => navigate('/')}>
        Modifica
      </button>
    </div>
  );
}

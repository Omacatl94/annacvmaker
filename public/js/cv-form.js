import { handleLogout } from './auth.js';
import { getUser } from './app.js';

export function renderDashboard(root) {
  root.textContent = '';
  const user = getUser();

  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard';

  // Header
  const header = document.createElement('header');
  header.className = 'dashboard-header';

  const h1 = document.createElement('h1');
  h1.textContent = 'CV Maker';
  header.appendChild(h1);

  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';

  const userName = document.createElement('span');
  userName.textContent = user.name || user.email;
  userInfo.appendChild(userName);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-secondary';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', handleLogout);
  userInfo.appendChild(logoutBtn);

  header.appendChild(userInfo);
  dashboard.appendChild(header);

  // Main
  const main = document.createElement('main');
  main.className = 'dashboard-main';

  const p = document.createElement('p');
  p.textContent = 'Dashboard — profilo CV in arrivo.';
  main.appendChild(p);

  dashboard.appendChild(main);
  root.appendChild(dashboard);
}

import { api } from './api.js';
import { renderLogin } from './auth.js';
import { renderDashboard } from './cv-form.js';

const root = document.getElementById('app');
let currentUser = null;

export function getUser() { return currentUser; }
export function setUser(u) { currentUser = u; }
export function getRoot() { return root; }

export async function navigate() {
  try {
    const { user } = await api.getMe();
    currentUser = user;
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    renderLogin(root);
  } else {
    renderDashboard(root);
  }
}

navigate();

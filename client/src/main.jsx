import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '../css/app.css';
import '../css/cv-layout.css';
import '../css/cv-themes.css';

// Restore saved theme
const saved = localStorage.getItem('jh-theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);


createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

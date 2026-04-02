import { JSDOM } from 'jsdom';

const FETCH_TIMEOUT = 8000;
const MAX_SECONDARY_PAGES = 5;
const MIN_USEFUL_CHARS = 200;

const BLOCKED_HOSTS = /^(localhost|127\.\d|10\.\d|192\.168\.|172\.(1[6-9]|2\d|3[01]))/;

const RELEVANT_LINK_PATTERNS = [
  /about/i, /chi.siamo/i, /careers/i, /lavora.con.noi/i,
  /team/i, /blog/i, /news/i, /company/i, /azienda/i,
  /mission/i, /values/i, /cultura/i, /culture/i, /jobs/i,
];

function validateUrl(raw) {
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (BLOCKED_HOSTS.test(url.hostname)) return null;
  return url.href;
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHacker/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const tag of ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe']) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }
  return (doc.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findRelevantLinks(html, baseUrl) {
  const dom = new JSDOM(html);
  const anchors = dom.window.document.querySelectorAll('a[href]');
  const found = new Set();
  const base = new URL(baseUrl);

  for (const a of anchors) {
    if (found.size >= MAX_SECONDARY_PAGES) break;
    try {
      const href = new URL(a.getAttribute('href'), baseUrl);
      if (href.hostname !== base.hostname) continue;
      const path = href.pathname + ' ' + (a.textContent || '');
      if (RELEVANT_LINK_PATTERNS.some((re) => re.test(path))) {
        found.add(href.origin + href.pathname);
      }
    } catch { /* skip bad URLs */ }
  }
  return [...found];
}

/**
 * Scrape a company website and extract useful context.
 * @param {string} rawUrl - URL provided by the user
 * @returns {{ ok: boolean, sparse?: boolean, url: string, text: string, pages: number, error?: string }}
 */
export async function scrapeSite(rawUrl) {
  const url = validateUrl(rawUrl);
  if (!url) {
    return { ok: false, error: 'URL non valido. Controlla l\'indirizzo e riprova.' };
  }

  const homeHtml = await fetchPage(url);
  if (!homeHtml) {
    return { ok: false, error: 'Non riesco a raggiungere questo sito. Controlla l\'URL.' };
  }

  const texts = [extractText(homeHtml)];
  const secondaryLinks = findRelevantLinks(homeHtml, url);

  const secondaryResults = await Promise.allSettled(
    secondaryLinks.map((link) => fetchPage(link))
  );
  for (const result of secondaryResults) {
    if (result.status === 'fulfilled' && result.value) {
      texts.push(extractText(result.value));
    }
  }

  const fullText = texts.join('\n\n').trim();
  const sparse = fullText.length < MIN_USEFUL_CHARS;

  return {
    ok: true,
    sparse,
    url,
    text: fullText.slice(0, 15000),
    pages: texts.length,
  };
}

export { validateUrl };

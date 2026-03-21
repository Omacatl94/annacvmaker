import { chromium } from 'playwright-core';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';
const LOCAL_ORIGIN = `http://localhost:${process.env.PORT || 3000}`;

export async function generatePDF(html) {
  // Extract CSS from <style> tags BEFORE sanitization (DOMPurify strips them)
  // Sanitize CSS: block url(), @import, and expression() to prevent data exfiltration
  function sanitizeCSS(css) {
    return css
      .replace(/@import\b[^;]*;?/gi, '/* @import blocked */')
      .replace(/url\s*\(\s*['"]?https?:\/\/[^)]*\)/gi, 'url(/* external blocked */)')
      .replace(/expression\s*\([^)]*\)/gi, '/* expression blocked */')
      .replace(/-moz-binding\s*:[^;]*/gi, '/* binding blocked */');
  }
  const styleBlocks = [];
  html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    styleBlocks.push(sanitizeCSS(css));
  });

  // Sanitize HTML body content — allow SVG and data attributes for CV rendering
  const sanitized = purify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'a', 'img',
      'section', 'article', 'header', 'footer', 'nav', 'main',
      'svg', 'path', 'circle', 'line', 'polyline', 'rect', 'g',
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'href', 'src', 'alt', 'width', 'height',
      'colspan', 'rowspan',
      'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
      'stroke-linejoin', 'xmlns', 'd', 'cx', 'cy', 'r', 'x', 'y',
      'x1', 'y1', 'x2', 'y2', 'rx', 'ry', 'points',
    ],
    ALLOW_DATA_ATTR: true,
  });

  // Reassemble full HTML with CSS preserved
  const cssBlock = styleBlocks.length > 0 ? `<style>${styleBlocks.join('\n')}</style>` : '';

  let cleanHtml = `<!DOCTYPE html>
<html><head>
<base href="${LOCAL_ORIGIN}/">
${cssBlock}
</head><body>
${sanitized}
</body></html>`;

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost'],
  });

  try {
    const page = await browser.newPage();

    // Bypass CORP headers for local resources (Helmet adds same-origin CORP
    // which blocks loads from setContent's null origin)
    await page.route('**/*', async (route) => {
      const response = await route.fetch();
      const headers = { ...response.headers() };
      delete headers['cross-origin-resource-policy'];
      delete headers['cross-origin-opener-policy'];
      await route.fulfill({ response, headers });
    });

    await page.setContent(cleanHtml, { waitUntil: 'load' });

    // Measure actual content height to produce a single continuous page
    let heightPx = 1123; // fallback: A4 height in px at 96dpi
    try {
      const contentHeight = await page.evaluate(() => {
        const el = document.querySelector('#cv-container') || document.body;
        // Force min-height override in case CSS specificity wins
        el.style.minHeight = 'auto';
        // Use getBoundingClientRect for more accurate measurement
        const rect = el.getBoundingClientRect();
        return Math.ceil(rect.height);
      });
      // Add small buffer to prevent rounding-induced page breaks
      heightPx = Math.max(contentHeight + 2, 1123);
    } catch {
      // If measurement fails, fall back to A4 height
    }

    const pdf = await page.pdf({
      width: '210mm',
      height: `${heightPx}px`,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      preferCSSPageSize: false,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

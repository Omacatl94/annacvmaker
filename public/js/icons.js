const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const BUILDERS = {
  sun() {
    const f = document.createDocumentFragment();
    f.appendChild(el('circle', { cx: '12', cy: '12', r: '5' }));
    const L = [[12,1,12,3],[12,21,12,23],[4.22,4.22,5.64,5.64],[18.36,18.36,19.78,19.78],[1,12,3,12],[21,12,23,12],[4.22,19.78,5.64,18.36],[18.36,5.64,19.78,4.22]];
    for (const [x1,y1,x2,y2] of L) f.appendChild(el('line', { x1, y1, x2, y2 }));
    return f;
  },
  moon() {
    return el('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' });
  },
  x() {
    const f = document.createDocumentFragment();
    f.appendChild(el('line', { x1: '18', y1: '6', x2: '6', y2: '18' }));
    f.appendChild(el('line', { x1: '6', y1: '6', x2: '18', y2: '18' }));
    return f;
  },
  mail() {
    const f = document.createDocumentFragment();
    f.appendChild(el('rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }));
    f.appendChild(el('path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }));
    return f;
  },
  phone() {
    return el('path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' });
  },
  coins() {
    const f = document.createDocumentFragment();
    f.appendChild(el('circle', { cx: '8', cy: '8', r: '6' }));
    f.appendChild(el('path', { d: 'M18.09 10.37A6 6 0 1 1 10.34 18' }));
    f.appendChild(el('path', { d: 'M7 6h1v4' }));
    f.appendChild(el('path', { d: 'm16.71 13.88.7.71-2.82 2.82' }));
    return f;
  },
  'shield-ban'() {
    const f = document.createDocumentFragment();
    f.appendChild(el('path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }));
    f.appendChild(el('path', { d: 'm4.243 5.21 14.39 12.472' }));
    return f;
  },
  'file-text'() {
    const f = document.createDocumentFragment();
    f.appendChild(el('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }));
    f.appendChild(el('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }));
    f.appendChild(el('path', { d: 'M10 9H8' }));
    f.appendChild(el('path', { d: 'M16 13H8' }));
    f.appendChild(el('path', { d: 'M16 17H8' }));
    return f;
  },
  clock() {
    const f = document.createDocumentFragment();
    f.appendChild(el('circle', { cx: '12', cy: '12', r: '10' }));
    f.appendChild(el('polyline', { points: '12 6 12 12 16 14' }));
    return f;
  },
  'file-up'() {
    const f = document.createDocumentFragment();
    f.appendChild(el('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }));
    f.appendChild(el('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }));
    f.appendChild(el('path', { d: 'M12 12v6' }));
    f.appendChild(el('path', { d: 'm15 15-3-3-3 3' }));
    return f;
  },
};

export function icon(name, opts = {}) {
  const size = opts.size || 20;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.display = 'inline-flex';
  svg.style.verticalAlign = 'middle';
  if (opts.class) svg.classList.add(opts.class);
  const builder = BUILDERS[name];
  if (builder) svg.appendChild(builder());
  return svg;
}

export { icon as themeIcon };

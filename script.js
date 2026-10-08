(() => {
  'use strict';

  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  const mobileQuery = window.matchMedia('(max-width: 850px)');
  mobileQuery.addEventListener('change', closeMenu);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navigation.querySelectorAll('a').forEach(link => {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    navigation.querySelectorAll('a').forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) observer.observe(section);
    });
  }

  // Measure HTML nodes so diagram arrows remain connected at every layout width.
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const provisioningEdges = [
    ['intake', 'validate'], ['validate', 'valid'],
    ['valid', 'invalid', 'side', 'No'], ['valid', 'check-client', 'down', 'Yes'],
    ['check-client', 'exists'], ['exists', 'existing', 'side', 'Yes'],
    ['exists', 'drive', 'down', 'No · new client'], ['drive', 'record'],
    ['record', 'confirm'], ['confirm', 'handoff']
  ];
  function drawDiagram(diagram) {
    const svg = diagram.querySelector('svg');
    const bounds = diagram.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const group = document.createElementNS(svgNamespace, 'g');
    group.setAttribute('class', 'connector-lines');
    const intelligence = diagram.dataset.diagram === 'intelligence';
    const vertical = intelligence && window.matchMedia('(max-width: 850px)').matches;
    const mobileTree = !intelligence && window.matchMedia('(max-width: 600px)').matches;
    const sequence = ['receive-context', 'prepare-context', 'ai-1', 'ai-2', 'ai-3', 'ai-4', 'ai-5', 'ai-6', 'kickoff-ready'];
    const edges = intelligence ? sequence.slice(0, -1).map((id, index) => [id, sequence[index + 1], vertical || index === 1 ? 'down' : 'forward']) : provisioningEdges;
    edges.forEach(([from, to, direction = 'down', label]) => {
      const a = document.getElementById(from).getBoundingClientRect();
      const b = document.getElementById(to).getBoundingClientRect();
      let x1, y1, x2, y2, path;
      if (mobileTree && direction === 'side') direction = 'down';
      if (mobileTree && (to === 'check-client' || to === 'drive')) direction = 'bypass';
      if (direction === 'bypass') {
        x1 = a.right - bounds.left;
        x2 = b.right - bounds.left;
        y1 = a.top + a.height / 2 - bounds.top;
        y2 = b.top + b.height / 2 - bounds.top;
        const lane = bounds.width - 6;
        path = `M${x1},${y1} H${lane} V${y2} H${x2}`;
      } else
      if (direction === 'side' || direction === 'forward') {
        x1 = (direction === 'side' ? a.left : a.right) - bounds.left;
        x2 = (direction === 'side' ? b.right : b.left) - bounds.left;
        y1 = a.top + a.height / 2 - bounds.top;
        y2 = b.top + b.height / 2 - bounds.top;
        const middle = (x1 + x2) / 2;
        path = `M${x1},${y1} H${middle} V${y2} H${x2}`;
      } else {
        x1 = a.left + (vertical ? 31 : a.width / 2) - bounds.left;
        x2 = b.left + (vertical ? 31 : b.width / 2) - bounds.left;
        y1 = a.bottom - bounds.top;
        y2 = b.top - bounds.top;
        const middle = (y1 + y2) / 2;
        path = `M${x1},${y1} V${middle} H${x2} V${y2}`;
      }
      const connector = document.createElementNS(svgNamespace, 'path');
      connector.setAttribute('class', 'connector');
      connector.setAttribute('d', path);
      connector.setAttribute('marker-end', `url(#${intelligence ? 'intelligence' : 'provisioning'}-arrow)`);
      connector.dataset.from = from;
      connector.dataset.to = to;
      group.append(connector);
      if (label) {
        const text = document.createElementNS(svgNamespace, 'text');
        text.textContent = mobileTree ? label.split(' · ')[0] : label;
        text.setAttribute('x', direction === 'bypass' ? bounds.width - 9 : direction === 'side' ? (x1 + x2) / 2 : x1 + 9);
        text.setAttribute('y', (y1 + y2) / 2 - (direction === 'side' ? 7 : -3));
        if (direction === 'side' || direction === 'bypass') text.setAttribute('text-anchor', 'middle');
        group.append(text);
      }
    });
    svg.querySelector('.connector-lines')?.remove();
    svg.append(group);
  }
  document.querySelectorAll('[data-diagram]').forEach(diagram => {
    new ResizeObserver(() => drawDiagram(diagram)).observe(diagram);
    drawDiagram(diagram);
  });

  // Native dialog supplies modal semantics, background inertness, and focus trapping.
  const viewer = document.querySelector('#image-viewer');
  const stage = viewer.querySelector('.viewer-stage');
  const wrap = viewer.querySelector('.viewer-image-wrap');
  const image = document.querySelector('#viewer-image');
  const title = document.querySelector('#viewer-title');
  const instructions = document.querySelector('#viewer-instructions');
  const zoomIn = document.querySelector('#zoom-in');
  const zoomOut = document.querySelector('#zoom-out');
  const zoomLevel = document.querySelector('#zoom-level');
  const reset = document.querySelector('#zoom-reset');
  const close = document.querySelector('#viewer-close');
  const pointers = new Map();
  let mode = 'standard';
  let zoom = 1;
  let baseWidth = 0;
  let baseHeight = 0;
  let panX = 0;
  let panY = 0;
  let trigger = null;
  let savedOverflow = '';
  let loadVersion = 0;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function bounds() {
    panX = clamp(panX, -Math.max(0, (baseWidth * zoom - stage.clientWidth) / 2), Math.max(0, (baseWidth * zoom - stage.clientWidth) / 2));
    panY = clamp(panY, -Math.max(0, (baseHeight * zoom - stage.clientHeight) / 2), Math.max(0, (baseHeight * zoom - stage.clientHeight) / 2));
  }
  function render() {
    image.style.width = `${baseWidth * zoom}px`;
    image.style.height = 'auto';
    if (mode === 'standard') {
      bounds();
      wrap.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`;
    } else wrap.style.transform = '';
    zoomLevel.value = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 4;
    viewer.classList.toggle('zoomed', mode === 'standard' && zoom > 1);
  }
  function fit() {
    if (!image.naturalWidth) return;
    if (mode === 'document') {
      baseWidth = Math.min(900, image.naturalWidth, Math.max(1, stage.clientWidth - (window.innerWidth <= 600 ? 16 : 32)));
    } else {
      const scale = Math.min(1, Math.max(1, stage.clientWidth - 28) / image.naturalWidth, Math.max(1, stage.clientHeight - 28) / image.naturalHeight);
      baseWidth = image.naturalWidth * scale;
    }
    baseHeight = baseWidth * image.naturalHeight / image.naturalWidth;
    render();
  }
  function setZoom(next, point) {
    const oldZoom = zoom;
    zoom = clamp(next, 1, 4);
    if (mode === 'document') {
      const x = point ? point.x : stage.clientWidth / 2;
      const y = point ? point.y : stage.clientHeight / 2;
      const oldImageLeft = wrap.offsetLeft;
      const oldImageTop = wrap.offsetTop;
      const relativeX = (stage.scrollLeft + x - oldImageLeft) / (baseWidth * oldZoom || 1);
      const relativeY = (stage.scrollTop + y - oldImageTop) / (baseHeight * oldZoom || 1);
      render();
      stage.scrollLeft = wrap.offsetLeft + relativeX * baseWidth * zoom - x;
      stage.scrollTop = wrap.offsetTop + relativeY * baseHeight * zoom - y;
    } else {
      const x = point ? point.x - stage.clientWidth / 2 : 0;
      const y = point ? point.y - stage.clientHeight / 2 : 0;
      panX = x - (x - panX) * zoom / oldZoom;
      panY = y - (y - panY) * zoom / oldZoom;
      render();
    }
  }
  function resetView() {
    zoom = 1;
    panX = panY = 0;
    fit();
    stage.scrollTo(0, 0);
  }
  function openViewer(button) {
    trigger = button;
    mode = button.dataset.mode;
    title.textContent = button.dataset.title;
    image.alt = button.dataset.title;
    instructions.textContent = mode === 'document' ? 'Scroll to read · Ctrl + wheel to zoom · + / − / 0 keyboard controls' : 'Wheel or pinch to zoom · Drag or arrow keys to pan · + / − / 0 keyboard controls';
    viewer.classList.toggle('document-mode', mode === 'document');
    pointers.clear();
    zoom = 1;
    panX = panY = 0;
    image.hidden = true;
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    viewer.showModal();
    close.focus();
    const version = ++loadVersion;
    image.onload = () => {
      if (version !== loadVersion || !viewer.open) return;
      image.hidden = false;
      resetView();
    };
    image.onerror = () => {
      if (version !== loadVersion) return;
      title.textContent = 'Screenshot unavailable';
      instructions.textContent = 'The original image could not be loaded. Close this viewer to continue.';
      image.hidden = true;
    };
    image.src = button.dataset.image;
    if (image.complete && image.naturalWidth) {
      image.hidden = false;
      resetView();
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('.image-trigger');
    if (button) openViewer(button);
  });
  close.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('close', () => {
    ++loadVersion;
    document.body.style.overflow = savedOverflow;
    pointers.clear();
    viewer.classList.remove('dragging');
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  zoomIn.addEventListener('click', () => setZoom(zoom + .25));
  zoomOut.addEventListener('click', () => setZoom(zoom - .25));
  reset.addEventListener('click', resetView);
  stage.addEventListener('wheel', event => {
    if (mode === 'document' && !event.ctrlKey) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    setZoom(zoom * Math.exp(-event.deltaY * .002), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  function pointerDistance() {
    const [a,b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  stage.addEventListener('pointerdown', event => {
    if (mode !== 'standard' || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    viewer.classList.add('dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    const previousDistance = pointers.size === 2 ? pointerDistance() : 0;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && previousDistance > 0) {
      const [a,b] = [...pointers.values()];
      const rect = stage.getBoundingClientRect();
      setZoom(zoom * pointerDistance() / previousDistance, { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top });
    } else if (zoom > 1) {
      panX += event.clientX - previous.x;
      panY += event.clientY - previous.y;
      render();
    }
  });
  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) viewer.classList.remove('dragging');
  }
  stage.addEventListener('pointerup', releasePointer);
  stage.addEventListener('pointercancel', releasePointer);
  stage.addEventListener('lostpointercapture', releasePointer);
  viewer.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + .25); }
    else if (event.key === '-') { event.preventDefault(); setZoom(zoom - .25); }
    else if (event.key === '0') { event.preventDefault(); resetView(); }
    else if (mode === 'standard' && zoom > 1 && event.key.startsWith('Arrow')) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') panX += 50;
      if (event.key === 'ArrowRight') panX -= 50;
      if (event.key === 'ArrowUp') panY += 50;
      if (event.key === 'ArrowDown') panY -= 50;
      render();
    }
  });
  new ResizeObserver(() => { if (viewer.open) fit(); }).observe(stage);

  // Missing assets retain useful captions without opening an empty lightbox.
  document.querySelectorAll('.image-trigger img').forEach(img => {
    function fallback() {
      const button = img.closest('button');
      const message = document.createElement('p');
      message.className = 'missing-image';
      message.textContent = `Screenshot unavailable: ${img.alt}`;
      button.replaceWith(message);
    }
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && !img.naturalWidth) fallback();
  });
})();

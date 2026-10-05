'use strict';

(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.querySelector('#hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const film = document.querySelector('.film');
  const progressBar = document.querySelector('#film-progress');
  const phase = document.querySelector('#film-phase');
  const frameNumber = document.querySelector('#frame-number');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const frameCount = 123;
  const cache = new Map();
  const pending = new Set();
  const failed = new Set();
  const maxCached = matchMedia('(max-width: 600px)').matches ? 14 : 22;
  let target = 0;
  let position = 0;
  let drawnFrame = -1;
  let raf = 0;
  let width = 0;
  let height = 0;
  let active = true;
  let direction = 1;

  function schedule() {
    if (!raf && active) raf = requestAnimationFrame(render);
  }

  function trimCache() {
    while (cache.size > maxCached) {
      // Retain frames nearest the playhead, rather than decoding the whole film.
      const farthest = [...cache.keys()].sort((a, b) => Math.abs(b - position) - Math.abs(a - position))[0];
      const bitmap = cache.get(farthest);
      if (bitmap.close) bitmap.close();
      cache.delete(farthest);
    }
  }

  async function loadFrame(index) {
    if (cache.has(index) || pending.has(index) || failed.has(index)) return;
    pending.add(index);
    try {
      const url = `assets/frames/${String(index).padStart(4, '0')}.jpg`;
      let bitmap;
      if ('createImageBitmap' in window && location.protocol !== 'file:') {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Frame ${index}: ${response.status}`);
        const blob = await response.blob();
        bitmap = await createImageBitmap(blob, { resizeWidth: innerWidth <= 600 ? 960 : 1600, resizeQuality: 'high' });
      } else {
        bitmap = new Image();
        bitmap.src = url;
        await bitmap.decode();
      }
      cache.set(index, bitmap);
      trimCache();
      schedule();
    } catch (error) {
      failed.add(index);
      console.warn('Animation frame unavailable; retaining the last image.', index);
    } finally {
      pending.delete(index);
      if (active) queueFrames();
    }
  }

  function queueFrames() {
    if (reducedMotion.matches) {
      if (!cache.has(frameCount - 1)) loadFrame(frameCount - 1);
      return;
    }
    const center = Math.round(position);
    const wanted = [center, Math.round(target), center + direction, center - direction];
    for (let offset = 2; offset <= 7; offset++) wanted.push(center + direction * offset);
    for (const index of wanted) {
      if (pending.size >= 4) break;
      if (index >= 0 && index < frameCount && !cache.has(index) && !pending.has(index) && !failed.has(index)) loadFrame(index);
    }
  }

  function draw(index) {
    const bitmap = cache.get(index);
    if (!bitmap || !width || !height || !ctx) return;
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.fillStyle = '#e8e5de';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
    drawnFrame = index;
    canvas.dataset.frame = String(index);
    frameNumber.textContent = String(index + 1).padStart(3, '0');
    film.classList.add('ready');
  }

  function render() {
    raf = 0;
    position = reducedMotion.matches ? frameCount - 1 : position + (target - position) * 0.19;
    if (Math.abs(position - target) < 0.04 && !reducedMotion.matches) position = target;
    const wanted = Math.round(position);
    let nearest = wanted;
    if (!cache.has(wanted) && cache.size) nearest = [...cache.keys()].reduce((a, b) => Math.abs(a - wanted) < Math.abs(b - wanted) ? a : b);
    if (nearest !== drawnFrame) draw(nearest);
    const progress = position / (frameCount - 1);
    progressBar.style.transform = `scaleX(${progress})`;
    const label = progress < .25 ? 'Всё начинается с пространства' : progress < .78 ? 'Дом обретает характер' : 'Теперь здесь хочется остаться';
    if (phase.textContent !== label) phase.textContent = label;
    queueFrames();
    if (!reducedMotion.matches && Math.abs(position - target) > .04) schedule();
  }

  function onScroll() {
    const bounds = hero.getBoundingClientRect();
    const travel = hero.offsetHeight - document.querySelector('.hero-sticky').offsetHeight;
    const next = Math.max(0, Math.min(1, -bounds.top / Math.max(1, travel))) * (frameCount - 1);
    direction = next >= target ? 1 : -1;
    target = next;
    active = bounds.bottom > 0 && bounds.top < innerHeight;
    schedule();
  }

  function resize() {
    const box = film.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.round(box.width * dpr);
    height = Math.round(box.height * dpr);
    canvas.width = width;
    canvas.height = height;
    drawnFrame = -1;
    onScroll();
  }

  if (ctx) {
    new ResizeObserver(resize).observe(film);
    addEventListener('scroll', onScroll, { passive: true });
    reducedMotion.addEventListener('change', () => { drawnFrame = -1; resize(); });
    loadFrame(reducedMotion.matches ? frameCount - 1 : 0);
    resize();
  }

  const projectDialog = document.querySelector('#project-dialog');
  const projectForm = document.querySelector('#project-form');
  const projectType = document.querySelector('#project-type');
  const formStatus = document.querySelector('#form-status');

  document.querySelectorAll('[data-project-modal]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      projectForm.reset();
      formStatus.textContent = '';
      projectType.value = trigger.dataset.projectType || 'Не определился';
      document.body.classList.add('modal-open');
      projectDialog.showModal();
    });
  });

  document.querySelector('[data-modal-close]').addEventListener('click', () => projectDialog.close());
  projectDialog.addEventListener('click', (event) => {
    if (event.target === projectDialog) projectDialog.close();
  });
  projectDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));

  projectForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(projectForm);
    const details = String(data.get('details') || '').trim();
    const message = [
      'Здравствуйте! Хочу обсудить проект SAPUN HOME.',
      `Имя: ${data.get('name')}`,
      `Контакт: ${data.get('contact')}`,
      `Формат: ${data.get('projectType')}`,
      details ? `Об объекте: ${details}` : ''
    ].filter(Boolean).join('\n');
    window.open(`https://t.me/sapun_home?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    formStatus.textContent = 'Telegram открыт с готовым сообщением. Проверьте текст и нажмите «Отправить».';
  });

})();

'use strict';

(() => {
  const hero = document.querySelector('.hero');
  const heroSticky = document.querySelector('.hero-sticky');
  const canvas = document.querySelector('#hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const film = document.querySelector('.film');
  const progressBar = document.querySelector('#film-progress');
  const phase = document.querySelector('#film-phase');
  const frameNumber = document.querySelector('#frame-number');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const frameCount = 123;
  const fullScrollDuration = 3000;
  const cache = new Map();
  const pending = new Set();
  const failed = new Set();
  const maxCached = matchMedia('(max-width: 600px)').matches ? 14 : 22;
  const smoothingTime = matchMedia('(max-width: 600px)').matches ? 190 : 150;
  let target = 0;
  let position = 0;
  let drawnFrame = -1;
  let drawnPosition = -1;
  let raf = 0;
  let previousTime = 0;
  let width = 0;
  let height = 0;
  let active = true;
  let direction = 1;
  let scrollTarget = scrollY;
  let scrollFrom = scrollY;
  let scrollStarted = 0;
  let scrollDuration = 0;
  let scrollRaf = 0;

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
      // A newly available neighbour may enable interpolation even if the
      // playhead has already stopped on the same fractional position.
      drawnPosition = -1;
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
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const center = Math.round(position);
    // Fill the path immediately around the playhead before fetching a distant
    // target frame. This prevents visible jumps during a quick scroll.
    const wanted = [lower, upper, center + direction, center - direction];
    for (let offset = 2; offset <= 8; offset++) wanted.push(center + direction * offset);
    wanted.push(Math.round(target));
    for (const index of wanted) {
      if (pending.size >= 4) break;
      if (index >= 0 && index < frameCount && !cache.has(index) && !pending.has(index) && !failed.has(index)) loadFrame(index);
    }
  }

  function drawBitmap(bitmap, opacity = 1) {
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.globalAlpha = opacity;
    ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
  }

  function draw(playhead) {
    if (!width || !height || !ctx || !cache.size) return;
    const lower = Math.floor(playhead);
    const upper = Math.ceil(playhead);
    const lowerBitmap = cache.get(lower);
    const upperBitmap = cache.get(upper);
    let visibleFrame;

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8e5de';
    ctx.fillRect(0, 0, width, height);

    if (lowerBitmap && upperBitmap && lower !== upper) {
      const blend = playhead - lower;
      drawBitmap(lowerBitmap);
      drawBitmap(upperBitmap, blend);
      visibleFrame = blend < .5 ? lower : upper;
    } else {
      const wanted = Math.round(playhead);
      visibleFrame = cache.has(wanted)
        ? wanted
        : [...cache.keys()].reduce((a, b) => Math.abs(a - wanted) < Math.abs(b - wanted) ? a : b);
      drawBitmap(cache.get(visibleFrame));
    }

    ctx.globalAlpha = 1;
    drawnFrame = visibleFrame;
    drawnPosition = playhead;
    canvas.dataset.frame = String(visibleFrame);
    frameNumber.textContent = String(visibleFrame + 1).padStart(3, '0');
    film.classList.add('ready');
  }

  function render(time) {
    raf = 0;
    const elapsed = previousTime ? Math.min(time - previousTime, 50) : 16.67;
    previousTime = time;
    const easing = 1 - Math.exp(-elapsed / smoothingTime);
    position = reducedMotion.matches ? frameCount - 1 : position + (target - position) * easing;
    if (Math.abs(position - target) < 0.04 && !reducedMotion.matches) position = target;
    if (Math.abs(position - drawnPosition) > .01 || drawnFrame < 0) draw(position);
    const progress = position / (frameCount - 1);
    progressBar.style.transform = `scaleX(${progress})`;
    const label = progress < .25 ? 'Всё начинается с пространства' : progress < .78 ? 'Дом обретает характер' : 'Теперь здесь хочется остаться';
    if (phase.textContent !== label) phase.textContent = label;
    queueFrames();
    if (!reducedMotion.matches && Math.abs(position - target) > .04) schedule();
  }

  function stopScrollAnimation() {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
    scrollTarget = scrollY;
  }

  function animateHeroScroll(time) {
    const progress = Math.min(1, (time - scrollStarted) / scrollDuration);
    scrollTo({ top: scrollFrom + (scrollTarget - scrollFrom) * progress, behavior: 'instant' });
    if (progress < 1) {
      scrollRaf = requestAnimationFrame(animateHeroScroll);
    } else {
      scrollRaf = 0;
      scrollTo({ top: scrollTarget, behavior: 'instant' });
    }
  }

  function onWheel(event) {
    if (!precisePointer.matches || reducedMotion.matches || event.ctrlKey || document.body.classList.contains('modal-open')) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const heroTop = scrollY + hero.getBoundingClientRect().top;
    const heroTravel = Math.max(1, hero.offsetHeight - heroSticky.offsetHeight);
    const heroEnd = heroTop + heroTravel;
    const current = scrollY;
    const insideHero = current >= heroTop - 1 && current <= heroEnd + 1;
    if (!insideHero) return;
    if (!scrollRaf) scrollTarget = current;

    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = event.deltaY * unit;
    const remainingDirection = Math.sign(scrollTarget - current);
    if (scrollRaf && remainingDirection && Math.sign(delta) !== remainingDirection) scrollTarget = current;

    const nextTarget = Math.max(heroTop, Math.min(heroEnd, scrollTarget + delta));
    const waitingAtEdge = scrollRaf && nextTarget === scrollTarget;
    if (nextTarget === current && !waitingAtEdge) return;

    event.preventDefault();
    if (nextTarget === scrollTarget && scrollRaf) return;

    scrollFrom = current;
    scrollTarget = nextTarget;
    scrollStarted = performance.now();
    scrollDuration = Math.max(250, fullScrollDuration * Math.abs(scrollTarget - scrollFrom) / heroTravel);
    if (!scrollRaf) scrollRaf = requestAnimationFrame(animateHeroScroll);
  }

  function onScroll() {
    const bounds = hero.getBoundingClientRect();
    const travel = hero.offsetHeight - heroSticky.offsetHeight;
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
    drawnPosition = -1;
    previousTime = 0;
    onScroll();
  }

  if (ctx) {
    new ResizeObserver(resize).observe(film);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('pointerdown', stopScrollAnimation, { passive: true });
    reducedMotion.addEventListener('change', () => { stopScrollAnimation(); drawnFrame = -1; resize(); });
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

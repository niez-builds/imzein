// Utility: clamp
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// Date in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Reduced motion detection
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Global mouse CSS variables for background reactivity
(function initBgMouseVars() {
  if (REDUCED) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) return;
  const root = document.documentElement;
  // track mouse velocity (normalized 0..1) to allow subtle intensity bursts
  let lastX = null, lastY = null, lastT = null;
  let vel = 0; // smoothed velocity 0..1
  const decay = 0.92; // per frame decay
  const updateFrame = () => {
    // decay velocity so effects fade out smoothly
    vel *= decay;
    if (vel < 0.001) vel = 0;
    root.style.setProperty('--mvel', vel.toFixed(3));
    requestAnimationFrame(updateFrame);
  };
  requestAnimationFrame(updateFrame);
  window.addEventListener(
    'mousemove',
    (e) => {
      const mxn = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
      const myn = e.clientY / window.innerHeight - 0.5; // -0.5..0.5
      root.style.setProperty('--mxn', mxn.toFixed(4));
      root.style.setProperty('--myn', myn.toFixed(4));

      // velocity calc
      const now = performance.now();
      if (lastX != null && lastY != null && lastT != null) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dt = Math.max(1, now - lastT);
        const dist = Math.hypot(dx, dy);
        const diag = Math.hypot(window.innerWidth, window.innerHeight) || 1;
        // pixels per ms normalized by screen diagonal
        const inst = (dist / dt) / (diag / 1000); // ~0..~1+
        // smooth and clamp
        vel = Math.min(1, vel * 0.7 + inst * 0.6);
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    },
    { passive: true }
  );
})();

// Custom cursor (desktop only)
(function initCursor() {
  const cursor = document.getElementById('cursor');
  const dot = document.getElementById('cursor-dot');
  if (!cursor || !dot) return;

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    cursor.style.display = 'none';
    dot.style.display = 'none';
    return;
  }

  let x = window.innerWidth / 2,
    y = window.innerHeight / 2,
    tx = x,
    ty = y;

  // Ensure initial centered placement using left/top so CSS translate(-50%,-50%) keeps it centered
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
  dot.style.left = `${tx}px`;
  dot.style.top = `${ty}px`;

  const speed = 0.18;
  const loop = () => {
    x += (tx - x) * speed;
    y += (ty - y) * speed;
    // Use left/top to avoid overriding CSS centering transform
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    dot.style.left = `${tx}px`;
    dot.style.top = `${ty}px`;
    requestAnimationFrame(loop);
  };
  loop();

  window.addEventListener('mousemove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    cursor.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`);
    cursor.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`);
  });

  // hover state
  const hoverables = document.querySelectorAll('a, button, .card');
  hoverables.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-grow'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-grow'));
  });
})();

// Scroll-in reveal
(function initReveal() {
  const cards = document.querySelectorAll('.card');
  if (!('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35, rootMargin: '0px 0px -10% 0px' }
  );
  document.querySelectorAll('.card').forEach((el) => io.observe(el));
})();

// 3D tilt and shine
(function initTilt() {
  if (REDUCED) return; // respect reduced motion
  const cards = document.querySelectorAll('.card');
  const state = new WeakMap();

  const perspective = 900;
  const maxTilt = 10; // degrees

  function onMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const rx = clamp((-dy / (rect.height / 2)) * maxTilt, -maxTilt, maxTilt);
    const ry = clamp((dx / (rect.width / 2)) * maxTilt, -maxTilt, maxTilt);

    const s = state.get(card) || { rx: 0, ry: 0, prx: 0, pry: 0 };
    s.rx += (rx - s.rx) * 0.25;
    s.ry += (ry - s.ry) * 0.25;

    card.style.transform = `perspective(${perspective}px) rotateX(${s.rx}deg) rotateY(${s.ry}deg)`;

    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--px', `${px}%`);
    card.style.setProperty('--py', `${py}%`);

    state.set(card, s);
  }

  function onLeave(e) {
    const card = e.currentTarget;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  }

  cards.forEach((card) => {
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
})();

// Smooth parallax on hero glow based on scroll
(function initParallax() {
  if (REDUCED) return;
  const glow = document.querySelector('.glow');
  if (!glow) return;
  const baseY = 0;
  // amplify ranges and scale by CSS reactivity
  const css = getComputedStyle(document.documentElement);
  const glowReact = parseFloat(css.getPropertyValue('--glow-react')) || 1;
  const maxShiftBase = 80; // px from scroll
  const maxMouseXBase = 42; // px from mouse X
  const maxMouseYBase = 18; // px from mouse Y
  const maxShift = maxShiftBase * glowReact;
  const maxMouseX = maxMouseXBase * glowReact;
  const maxMouseY = maxMouseYBase * glowReact;
  let t = 0; // scroll factor 0..1
  let mx = 0, my = 0; // -0.5 .. 0.5

  const update = () => {
    const x = mx * maxMouseX;
    const y = baseY + t * maxShift + my * maxMouseY;
    glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const onScroll = () => {
    t = clamp(window.scrollY / (window.innerHeight * 1.2), 0, 1);
    update();
  };
  document.addEventListener('scroll', onScroll, { passive: true });

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) {
    window.addEventListener(
      'mousemove',
      (e) => {
        mx = e.clientX / window.innerWidth - 0.5;
        my = e.clientY / window.innerHeight - 0.5;
        update();
      },
      { passive: true }
    );
  }
  onScroll();
})();

// Hero starfield subtle parallax (mouse + scroll)
(function initStarParallax() {
  if (REDUCED) return;
  const star = document.querySelector('.starfield');
  if (!star) return;
  let mx = 0, my = 0; // normalized -0.5..0.5
  let sx = 0, sy = 0; // scroll factor 0..1
  const css = getComputedStyle(document.documentElement);
  const starReact = parseFloat(css.getPropertyValue('--star-react')) || 1;
  const max = 28 * starReact; // px translate (mouse)
  const scrollX = 10 * starReact; // px translate from scroll
  const scrollY = 14 * starReact; // px translate from scroll

  const update = () => {
    const tx = (mx * max) + (sx * scrollX);
    const ty = (my * max) + (sy * scrollY);
    star.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  };
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth) - 0.5;
    my = (e.clientY / window.innerHeight) - 0.5;
    update();
  }, { passive: true });
  const onScroll = () => {
    sy = clamp(window.scrollY / (window.innerHeight * 1.5), 0, 1);
    sx = sy;
    update();
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Comet canvas in hero (rare soft streaks)
(function initComets() {
  if (REDUCED) return;
  const canvas = document.querySelector('.comet-canvas');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let w = 0, h = 0, running = true;
  const comets = [];

  function resize() {
    const rect = hero.getBoundingClientRect();
    w = Math.floor(rect.width);
    h = Math.floor(rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function spawnComet() {
    const startX = Math.random() * w * 0.6 - w * 0.1;
    const startY = -40;
    const speed = 120 + Math.random() * 80; // px/s
    const angle = (25 + Math.random() * 10) * (Math.PI / 180);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    comets.push({ x: startX, y: startY, vx, vy, life: 0, maxLife: 1.6 + Math.random() * 0.6 });
  }

  let last = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = (now - last) / 1000;
    last = now;
    ctx.clearRect(0, 0, w, h);

    // chance to spawn (very subtle)
    if (Math.random() < dt * 0.25) spawnComet();

    comets.forEach((c) => {
      c.life += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
    });
    // draw
    comets.forEach((c) => {
      const t = c.life / c.maxLife;
      if (t > 1) return;
      const alpha = (1 - t) * 0.7;
      const len = 140;
      const dx = -c.vx / 4; // trail direction
      const dy = -c.vy / 4;
      const nx = c.x + dx * (len / Math.hypot(dx, dy));
      const ny = c.y + dy * (len / Math.hypot(dx, dy));
      const grad = ctx.createLinearGradient(nx, ny, c.x, c.y);
      grad.addColorStop(0, 'rgba(109,243,255,0)');
      grad.addColorStop(1, `rgba(122,162,255,${alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    });

    // cleanup
    for (let i = comets.length - 1; i >= 0; i--) {
      if (comets[i].life > comets[i].maxLife || comets[i].y > h + 60) comets.splice(i, 1);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    running = document.visibilityState === 'visible';
    if (running) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  });
})();

// Cursor sparkle trail + click burst
(function initCursorTrail() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch || REDUCED) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'cursor-trail';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9998,
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let w = 0, h = 0, running = true;
  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  let mouseX = w / 2, mouseY = h / 2, moved = false;

  function spawnParticle(x, y, burst = false) {
    const angle = Math.random() * Math.PI * 2;
    const speed = burst ? (40 + Math.random() * 120) : (10 + Math.random() * 30);
    const life = burst ? (0.5 + Math.random() * 0.6) : (0.35 + Math.random() * 0.3);
    const size = burst ? (1.5 + Math.random() * 2.2) : (0.8 + Math.random() * 1.2);
    const hue = 200 + Math.random() * 60; // bluish band
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, age: 0, size, hue });
  }

  function spawnTrail(x, y) {
    for (let i = 0; i < 2; i++) spawnParticle(x, y, false);
  }

  function spawnBurst(x, y, count = 18) {
    for (let i = 0; i < count; i++) spawnParticle(x, y, true);
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY; moved = true; spawnTrail(mouseX, mouseY);
  }, { passive: true });

  // Expose burst for card clicks
  document.addEventListener('click', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (card) {
      spawnBurst(e.clientX, e.clientY);
    }
  });

  let last = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98; // drag
      const alpha = (1 - t) * 0.7;
      ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // If not moving, slowly emit fewer particles
    if (!moved && Math.random() < 0.05) spawnTrail(mouseX, mouseY);
    moved = false;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    running = document.visibilityState === 'visible';
    if (running) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  });
})();

// Magnetic hover for CTA and chips
(function initMagnetic() {
  if (REDUCED) return;
  const sels = ['.hero__cta', '.chip'];
  const els = document.querySelectorAll(sels.join(','));
  if (!els.length) return;
  const strength = 10; // px
  els.forEach((el) => {
    let raf = 0; let tx = 0, ty = 0;
    function onMove(e) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      tx = clamp(dx, -1, 1) * strength;
      ty = clamp(dy, -1, 1) * strength;
      if (!raf) raf = requestAnimationFrame(apply);
    }
    function apply() {
      raf = 0;
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }
    function onLeave() {
      el.style.transform = '';
    }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  });
})();

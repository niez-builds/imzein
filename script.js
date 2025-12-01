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

// =========================
// Hidden Easter Egg modes
// =========================
(function initEasterEggs() {
  // Reusable overlay modal creator
  function createEggOverlay(title) {
    const overlay = document.createElement('div');
    overlay.className = 'egg-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'egg-modal';
    const header = document.createElement('header');
    const h3 = document.createElement('h3');
    h3.textContent = title || 'Overlay';
    const close = document.createElement('button');
    close.className = 'egg-close';
    close.type = 'button';
    close.innerText = 'Close ✕';
    header.appendChild(h3);
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'egg-body';

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Accessibility and interaction trapping
    // 1) prevent page scroll/arrow key navigation while open
    const preventKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Spacebar','PageUp','PageDown','Home','End']);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); destroy(); return; }
      if (preventKeys.has(e.key)) {
        e.preventDefault();
      }
    };
    // 2) prevent wheel/scroll gestures from scrolling the background
    const onWheel = (e) => { e.preventDefault(); };
    const onTouchMove = (e) => { e.preventDefault(); };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });

    const onClick = (e) => {
      if (e.target === overlay) destroy();
    };
    close.addEventListener('click', () => destroy());
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);

    // 3) focus trap inside the modal
    const focusables = () => Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
    const onFocusIn = (e) => {
      if (!modal.contains(e.target)) {
        const f = focusables();
        if (f.length) f[0].focus(); else close.focus();
      }
    };
    document.addEventListener('focusin', onFocusIn);
    // initial focus
    setTimeout(() => { try { (focusables()[0] || close).focus(); } catch(_){} }, 0);

    // 4) lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function destroy() {
      document.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onClick);
      overlay.removeEventListener('wheel', onWheel);
      overlay.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = prevOverflow;
      overlay.remove();
    }
    return { body, destroy, root: overlay };
  }

  // --- Mode 1: Konami → Snake ---
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let kIndex = 0;
  document.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; // normalize
    if (key === KONAMI[kIndex] || (KONAMI[kIndex] === 'b' && key === 'b') || (KONAMI[kIndex] === 'a' && key === 'a')) {
      kIndex++;
      if (kIndex === KONAMI.length) {
        kIndex = 0;
        launchSnake();
      }
    } else {
      // small tolerance: if current key is start of sequence, set index accordingly
      kIndex = (key === KONAMI[0]) ? 1 : 0;
    }
  });

  function launchSnake() {
    const { body, destroy, root } = createEggOverlay('Snake — use arrow keys');
    const canvas = document.createElement('canvas');
    body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let cols = 28, rows = 20, cell = 18; // base, will be recalculated
    let rafResize = 0;

    function resize() {
      const r = body.getBoundingClientRect();
      const pad = 0;
      const maxW = Math.floor(r.width - pad);
      const maxH = Math.floor(r.height - pad);
      // choose cell size to fit with some margin
      cell = Math.max(12, Math.floor(Math.min(maxW / cols, maxH / rows)));
      const width = cols * cell;
      const height = rows * cell;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const onResize = () => { if (!rafResize) rafResize = requestAnimationFrame(() => { rafResize = 0; resize(); }); };
    resize();
    window.addEventListener('resize', onResize);

    // state
    let snake = [{x: Math.floor(cols/2), y: Math.floor(rows/2)}];
    let dir = {x: 1, y: 0};
    let nextDir = {x: 1, y: 0};
    let food = spawnFood();
    let score = 0;
    let tickMs = 110;
    let timer = null;
    let alive = true;

    function spawnFood() {
      while (true) {
        const fx = Math.floor(Math.random() * cols);
        const fy = Math.floor(Math.random() * rows);
        if (!snake.some(s => s.x === fx && s.y === fy)) return {x: fx, y: fy};
      }
    }

    function drawCell(x, y, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
    }

    function draw() {
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      // grid subtle
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= cols; x++) {
        ctx.beginPath(); ctx.moveTo(x*cell+0.5, 0); ctx.lineTo(x*cell+0.5, rows*cell); ctx.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        ctx.beginPath(); ctx.moveTo(0, y*cell+0.5); ctx.lineTo(cols*cell, y*cell+0.5); ctx.stroke();
      }
      // food
      drawCell(food.x, food.y, 'rgba(109,243,255,0.9)');
      // snake
      snake.forEach((s, i) => {
        const c = i === 0 ? 'rgba(122,162,255,0.95)' : 'rgba(122,162,255,0.65)';
        drawCell(s.x, s.y, c);
      });
      // score
      ctx.fillStyle = '#e6e7ea';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText(`Score: ${score}`, 8, 18);
    }

    function step() {
      if (!alive) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      // wrap
      head.x = (head.x + cols) % cols;
      head.y = (head.y + rows) % rows;
      // self hit
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        alive = false;
        clearInterval(timer);
        ctx.fillStyle = 'rgba(10,12,18,0.8)';
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.fillStyle = '#e6e7ea';
        ctx.font = '600 18px Inter, system-ui, sans-serif';
        ctx.fillText('You crashed — press R to restart or Esc to close', 18, 34);
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        food = spawnFood();
        // slightly speed up
        tickMs = Math.max(70, tickMs - 2);
        clearInterval(timer);
        timer = setInterval(loop, tickMs);
      } else {
        snake.pop();
      }
      draw();
    }
    function loop() { step(); }
    draw();
    timer = setInterval(loop, tickMs);

    const onKey = (e) => {
      if (!alive && (e.key === 'r' || e.key === 'R')) {
        // restart
        snake = [{x: Math.floor(cols/2), y: Math.floor(rows/2)}];
        dir = {x: 1, y: 0};
        nextDir = {x: 1, y: 0};
        food = spawnFood();
        score = 0; tickMs = 110; alive = true; draw();
        clearInterval(timer); timer = setInterval(loop, tickMs);
      }
      const k = e.key;
      if (k === 'ArrowUp' && dir.y !== 1) nextDir = {x: 0, y: -1};
      else if (k === 'ArrowDown' && dir.y !== -1) nextDir = {x: 0, y: 1};
      else if (k === 'ArrowLeft' && dir.x !== 1) nextDir = {x: -1, y: 0};
      else if (k === 'ArrowRight' && dir.x !== -1) nextDir = {x: 1, y: 0};
    };
    document.addEventListener('keydown', onKey);

    // Fullscreen button
    const fsBtn1 = document.createElement('button');
    fsBtn1.type = 'button';
    Object.assign(fsBtn1.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 2,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    function updateFsLabel1(){ fsBtn1.textContent = (document.fullscreenElement === canvas) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabel1();
    fsBtn1.addEventListener('click', () => {
      if (document.fullscreenElement === canvas) { document.exitFullscreen?.(); }
      else { canvas.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabel1);
    body.appendChild(fsBtn1);

    // cleanup on close
    const originalDestroy = destroy;
    function cleanupAndDestroy() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      try {
        if (document.fullscreenElement && root.contains(document.fullscreenElement)) {
          document.exitFullscreen?.();
        }
      } catch(_){}
      document.removeEventListener('fullscreenchange', updateFsLabel1);
      originalDestroy();
    }
    // replace destroy reference inside closure
    // eslint-disable-next-line no-func-assign
    destroy = cleanupAndDestroy;
  }

  // --- Mode 2: Avatar Rapid Clicks → Star Catcher ---
  const initials = document.querySelector('.avatar__initials');
  if (initials) {
    let clicks = [];
    const windowMs = 2500;
    initials.addEventListener('click', () => {
      const now = performance.now();
      clicks.push(now);
      clicks = clicks.filter(t => now - t <= windowMs);
      if (clicks.length >= 6) {
        clicks = [];
        launchStarCatcher();
      }
    });
  }

  function launchStarCatcher() {
    const { body, destroy, root } = createEggOverlay('Star Catcher — click as many as you can!');
    const container = document.createElement('div');
    container.className = 'egg-play-root';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    // HUD
    const hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.left = '10px';
    hud.style.top = '8px';
    hud.style.zIndex = '2';
    hud.style.padding = '6px 10px';
    hud.style.borderRadius = '10px';
    hud.style.background = 'rgba(0,0,0,0.35)';
    hud.style.border = '1px solid rgba(122,162,255,0.25)';
    hud.style.color = '#e6e7ea';
    hud.style.font = '600 13px Inter, system-ui, sans-serif';
    const scoreEl = document.createElement('span');
    const timeEl = document.createElement('span');
    scoreEl.textContent = 'Score: 0';
    timeEl.textContent = 'Time: 20.0s';
    hud.appendChild(scoreEl);
    const sep = document.createElement('span'); sep.textContent = '  •  '; sep.style.opacity = '0.6';
    hud.appendChild(sep);
    hud.appendChild(timeEl);
    container.appendChild(hud);

    body.appendChild(container);

    // Fullscreen button
    const fsBtnSC = document.createElement('button');
    fsBtnSC.type = 'button';
    Object.assign(fsBtnSC.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 3,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    function updateFsLabelSC(){ fsBtnSC.textContent = (document.fullscreenElement === container) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabelSC();
    fsBtnSC.addEventListener('click', () => {
      if (document.fullscreenElement === container) { document.exitFullscreen?.(); }
      else { container.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabelSC);
    body.appendChild(fsBtnSC);

    let score = 0;
    let running = true;
    let spawnInt = null;
    let lastTs = performance.now();
    let remain = 20.0; // seconds

    function spawnStar() {
      if (!running) return;
      const star = document.createElement('div');
      const size = 14 + Math.random() * 16;
      Object.assign(star.style, {
        position: 'absolute',
        width: `${size}px`, height: `${size}px`,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(122,162,255,0.85) 40%, rgba(109,243,255,0.65) 70%, rgba(0,0,0,0) 72%)',
        boxShadow: '0 0 12px rgba(122,162,255,0.6), 0 0 24px rgba(109,243,255,0.45) inset',
        cursor: 'pointer',
        transform: `translate(-50%, -50%) scale(${0.86 + Math.random()*0.2})`,
        transition: 'transform .12s ease, opacity .12s ease',
      });
      const rect = container.getBoundingClientRect();
      const x = 20 + Math.random() * (rect.width - 40);
      const y = 30 + Math.random() * (rect.height - 60);
      star.style.left = `${x}px`;
      star.style.top = `${y}px`;
      star.addEventListener('mouseenter', () => { star.style.transform += ' scale(1.05)'; });
      star.addEventListener('mouseleave', () => { star.style.transform = star.style.transform.replace(' scale(1.05)',''); });
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        score++;
        scoreEl.textContent = `Score: ${score}`;
        star.style.opacity = '0';
        star.style.transform += ' scale(0.6)';
        setTimeout(() => star.remove(), 140);
      }, { once: true });
      container.appendChild(star);
      // auto remove after some time
      setTimeout(() => star.remove(), 1500 + Math.random()*1500);
    }

    function tickTime() {
      const now = performance.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      remain = Math.max(0, remain - dt);
      timeEl.textContent = `Time: ${remain.toFixed(1)}s`;
      if (remain <= 0 && running) endRound();
    }

    const timeInt = setInterval(tickTime, 100);
    spawnInt = setInterval(spawnStar, 420);
    // initial burst
    for (let i = 0; i < 6; i++) spawnStar();

    function endRound() {
      running = false;
      clearInterval(spawnInt);
      clearInterval(timeInt);
      const end = document.createElement('div');
      Object.assign(end.style, {
        position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
        background: 'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))',
        color: '#e6e7ea',
        font: '600 18px Inter, system-ui, sans-serif',
      });
      end.textContent = `Time! Final score: ${score}. Click anywhere to close.`;
      container.appendChild(end);
      container.addEventListener('click', () => destroy(), { once: true });
    }

    // cleanup on close
    const originalDestroy = destroy;
    function cleanupAndDestroy() {
      running = false;
      clearInterval(spawnInt);
      clearInterval(timeInt);
      try { if (document.fullscreenElement === container) { document.exitFullscreen?.(); } } catch(_){ }
      document.removeEventListener('fullscreenchange', updateFsLabelSC);
      originalDestroy();
    }
    // eslint-disable-next-line no-func-assign
    destroy = cleanupAndDestroy;
  }
  
  // --- Simple hidden button launcher ---
  (function initHiddenLauncher() {
    // Create subtle launcher button (no changes to HTML needed)
    const btn = document.createElement('button');
    btn.className = 'egg-launcher';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open extras');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2.6 5.7 6.3.6-4.7 4.2 1.4 6.1L12 16.8 6.4 19.6l1.4-6.1L3 9.3l6.3-.6L12 3z" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';
    document.body.appendChild(btn);

    // Open a tiny picker using existing overlay
    function openPicker() {
      const { body, destroy } = createEggOverlay('Extras');
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.gap = '10px';
      wrap.style.padding = '10px';

      function makeAction(label, onClick) {
        const a = document.createElement('button');
        a.type = 'button';
        a.textContent = label;
        Object.assign(a.style, {
          appearance: 'none',
          border: '1px solid rgba(122,162,255,0.35)',
          background: 'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
          color: '#e6e7ea',
          borderRadius: '10px',
          padding: '10px 12px',
          font: '600 14px Inter, system-ui, sans-serif',
          cursor: 'pointer',
          textAlign: 'left'
        });
        a.addEventListener('click', () => { destroy(); onClick(); });
        a.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.click(); } });
        return a;
      }

      wrap.appendChild(makeAction('▶ Play Snake', () => launchSnake()));
      wrap.appendChild(makeAction('★ Play Star Catcher', () => launchStarCatcher()));
      wrap.appendChild(makeAction('⬢ Arena (prototype)', () => launchArena()));
      wrap.appendChild(makeAction('Future Racing', () => launchHexGL()));
      wrap.appendChild(makeAction('Rally Racing', () => launchTriggerRally()));
      wrap.appendChild(makeAction('● Connect Four', () => launchConnectFour()));
      // The following modes are intentionally hidden/disabled
      // wrap.appendChild(makeAction('⛰ Hill Climb Run', () => launchHillRun()));
      // wrap.appendChild(makeAction('🚲 Wheelie Balance', () => launchWheelie()));
      // wrap.appendChild(makeAction('🌀 Helix Jump', () => launchHelixJump()));
      body.appendChild(wrap);
    }

    btn.addEventListener('click', openPicker);

    // Long‑press on the button (touch) to open
    let lpTimer = null;
    btn.addEventListener('touchstart', () => {
      lpTimer = setTimeout(() => { if (document.body.contains(btn)) btn.click(); }, 600);
    }, { passive: true });
    btn.addEventListener('touchend', () => { clearTimeout(lpTimer); lpTimer = null; });
    btn.addEventListener('touchcancel', () => { clearTimeout(lpTimer); lpTimer = null; });

    // Dwell reveal near bottom‑right corner
    let dwellTimer = null; let shown = false;
    function nearCorner(x, y) {
      const margin = 72;
      return x > (window.innerWidth - margin) && y > (window.innerHeight - margin);
    }
    window.addEventListener('mousemove', (e) => {
      if (nearCorner(e.clientX, e.clientY)) {
        if (!dwellTimer) {
          dwellTimer = setTimeout(() => { btn.classList.add('show'); shown = true; }, 800);
        }
      } else {
        clearTimeout(dwellTimer); dwellTimer = null;
        if (!btn.matches(':focus-visible') && !btn.matches(':hover')) {
          btn.classList.remove('show'); shown = false;
        }
      }
    }, { passive: true });

    // Hide when focus lost (unless hovered)
    btn.addEventListener('blur', () => {
      if (!btn.matches(':hover')) btn.classList.remove('show');
    });
  })();

  // --- Mode 3: Arena (lightweight tank demo) ---
  function launchArena() {
    const { body, destroy, root } = createEggOverlay('Arena — WASD/Arrows to move, mouse to aim, click to fire, U to upgrade');
    const canvas = document.createElement('canvas');
    body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let vw = 800, vh = 520; // viewport
    const world = { w: 6000, h: 6000 };

    function resize() {
      const r = body.getBoundingClientRect();
      vw = Math.max(480, Math.floor(r.width));
      vh = Math.max(320, Math.floor(r.height));
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.width = vw + 'px';
      canvas.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const onResize = () => requestAnimationFrame(resize);
    window.addEventListener('resize', onResize);

    // camera
    const cam = { x: 0, y: 0, shake: 0 };
    const setCamToPlayer = (p) => {
      cam.x += ((p.x - vw/2) - cam.x) * 0.18;
      cam.y += ((p.y - vh/2) - cam.y) * 0.18;
      cam.x = clamp(cam.x, 0, world.w - vw);
      cam.y = clamp(cam.y, 0, world.h - vh);
    };

    // state
    const keys = new Set();
    let mouse = { x: vw/2, y: vh/2, down: false };
    const player = {
      x: world.w/2, y: world.h/2, vx: 0, vy: 0,
      speed: 360, angle: 0, hp: 100, hpMax: 100, regen: 4,
      cooldown: 0, reload: 0.12, bulletSpeed: 580, bulletDmg: 12, bulletHP: 1, bulletSize: 3.2,
      bodyDmg: 8,
      level: 1, xp: 0, nextXP: 50, points: 0
    };
    const bullets = [];
    const shapes = []; // neutral shapes as in diep.io
    let score = 0;
    let running = true;
    let showUpgrades = false;

    const rng = (a,b)=>a+Math.random()*(b-a);

    function spawnShape(kind) {
      // kinds: square, triangle, pentagon
      const margin = 200;
      let x = rng(margin, world.w-margin);
      let y = rng(margin, world.h-margin);
      const types = {
        square: { r: 16, hp: 30, xp: 12, color: 'rgba(255,230,120,0.85)' },
        triangle: { r: 14, hp: 22, xp: 9, color: 'rgba(255,180,120,0.85)' },
        pentagon: { r: 24, hp: 90, xp: 40, color: 'rgba(180,160,255,0.85)' }
      };
      const t = types[kind];
      shapes.push({ kind, x, y, r: t.r, hp: t.hp, xp: t.xp, color: t.color, rot: Math.random()*Math.PI });
    }

    // initial population (higher density)
    for (let i=0;i<120;i++) spawnShape(Math.random()<0.65?'square':(Math.random()<0.5?'triangle':'pentagon'));
    let shapeSpawnAcc = 0;

    // input (capture on overlay)
    const onKeyDown = (e) => {
      keys.add(e.key);
      if (e.key === 'u' || e.key === 'U') { showUpgrades = !showUpgrades; e.preventDefault(); }
      if (e.key === 'p' || e.key === 'P') { running = !running; e.preventDefault(); if (running) requestAnimationFrame(loop); }
    };
    const onKeyUp = (e) => keys.delete(e.key);
    const onMouseMove = (e) => { const rect = canvas.getBoundingClientRect(); mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; };
    const onMouseDown = () => { mouse.down = true; };
    const onMouseUp = () => { mouse.down = false; };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // upgrades
    const upgrades = [
      { key: '1', name: 'Reload', apply: ()=>{ player.reload = Math.max(0.05, player.reload*0.92); } },
      { key: '2', name: 'Bullet Speed', apply: ()=>{ player.bulletSpeed *= 1.08; } },
      { key: '3', name: 'Bullet Damage', apply: ()=>{ player.bulletDmg *= 1.12; } },
      { key: '4', name: 'Penetration', apply: ()=>{ player.bulletHP += 1; } },
      { key: '5', name: 'Move Speed', apply: ()=>{ player.speed *= 1.06; } },
      { key: '6', name: 'Max Health', apply: ()=>{ player.hpMax += 20; player.hp += 20; } },
      { key: '7', name: 'Regen', apply: ()=>{ player.regen *= 1.18; } },
      { key: '8', name: 'Bullet Size', apply: ()=>{ player.bulletSize *= 1.1; } },
      { key: '9', name: 'Body Impact', apply: ()=>{ player.bodyDmg *= 1.18; } }
    ];
    const onUpgradeKey = (e) => {
      const u = upgrades.find(u=>u.key===e.key);
      if (u && player.points>0) { u.apply(); player.points--; e.preventDefault(); }
    };
    document.addEventListener('keydown', onUpgradeKey);

    function giveXP(amount){
      player.xp += amount; score += amount;
      while (player.xp >= player.nextXP) {
        player.xp -= player.nextXP;
        player.level += 1; player.points += 1;
        player.nextXP = Math.floor(player.nextXP * 1.35 + 10);
      }
    }

    function shoot() {
      if (player.cooldown > 0) return;
      const ang = Math.atan2((mouse.y+cam.y) - player.y, (mouse.x+cam.x) - player.x);
      const sp = player.bulletSpeed;
      const speedK = 22;
      bullets.push({ x: player.x + Math.cos(ang)*speedK, y: player.y + Math.sin(ang)*speedK, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp, life: 0, max: 1.5, hp: player.bulletHP, dmg: player.bulletDmg, r: player.bulletSize });
      player.cooldown = player.reload;
      cam.shake = Math.min(6, cam.shake + 1.2);
    }

    let last = performance.now();
    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // movement
      let ax = 0, ay = 0;
      if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) ay -= 1;
      if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) ay += 1;
      if (keys.has('a') || keys.has('A') || keys.has('ArrowLeft')) ax -= 1;
      if (keys.has('d') || keys.has('D') || keys.has('ArrowRight')) ax += 1;
      const len = Math.hypot(ax, ay) || 1; ax/=len; ay/=len;
      player.vx += ax * player.speed * dt; player.vy += ay * player.speed * dt;
      // slightly less drag for snappier feel
      player.vx *= 0.93; player.vy *= 0.93;
      player.x = clamp(player.x + player.vx * dt, 20, world.w - 20);
      player.y = clamp(player.y + player.vy * dt, 20, world.h - 20);
      player.hp = Math.min(player.hpMax, player.hp + player.regen * dt);
      player.angle = Math.atan2((mouse.y+cam.y) - player.y, (mouse.x+cam.x) - player.x);
      player.cooldown = Math.max(0, player.cooldown - dt);
      if (mouse.down) shoot();

      // bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life += dt; if (b.life > b.max) { bullets.splice(i,1); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        // cull outside world
        if (b.x < -50 || b.y < -50 || b.x>world.w+50 || b.y>world.h+50) { bullets.splice(i,1); continue; }
      }

      // spawn shapes more aggressively for a busier arena
      shapeSpawnAcc += dt;
      const cap = 420;
      if (shapeSpawnAcc > 0.15 && shapes.length < cap) {
        shapeSpawnAcc = 0;
        // spawn 1-3 shapes depending on current population
        const deficit = Math.max(1, Math.ceil((cap - shapes.length) / 140));
        const count = Math.min(3, deficit);
        for (let n=0;n<count;n++){
          const r = Math.random();
          spawnShape(r<0.6?'square':(r<0.85?'triangle':'pentagon'));
        }
      }

      // collisions with shapes
      for (let i=shapes.length-1;i>=0;i--) {
        const s = shapes[i];
        // bullet hits
        for (let j=bullets.length-1;j>=0;j--) {
          const b = bullets[j];
          if (Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.r) {
            b.hp -= 1; s.hp -= b.dmg; cam.shake = Math.min(8, cam.shake + 0.8);
            if (b.hp <= 0) bullets.splice(j,1);
            if (s.hp <= 0) { giveXP(s.xp); shapes.splice(i,1); break; }
          }
        }
        // player collides
        const dist = Math.hypot(player.x - s.x, player.y - s.y);
        if (dist < s.r + 14) {
          const overlap = s.r + 14 - dist;
          const ang = Math.atan2(player.y - s.y, player.x - s.x);
          player.x += Math.cos(ang) * overlap * 0.6;
          player.y += Math.sin(ang) * overlap * 0.6;
          player.hp -= Math.max(0, (20 + s.r*0.6) * dt - player.bodyDmg*0.02);
        }
      }

      // camera follow
      setCamToPlayer(player);

      // draw
      ctx.clearRect(0,0,vw,vh);
      // background
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0,0,vw,vh);

      // grid in world space
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const grid = 48;
      const startX = Math.floor(cam.x / grid) * grid - cam.x;
      const startY = Math.floor(cam.y / grid) * grid - cam.y;
      for (let x = startX; x <= vw; x += grid) { ctx.beginPath(); ctx.moveTo(Math.floor(x)+0.5, 0); ctx.lineTo(Math.floor(x)+0.5, vh); ctx.stroke(); }
      for (let y = startY; y <= vh; y += grid) { ctx.beginPath(); ctx.moveTo(0, Math.floor(y)+0.5); ctx.lineTo(vw, Math.floor(y)+0.5); ctx.stroke(); }

      // visible shapes
      shapes.forEach(s => {
        const sx = s.x - cam.x; const sy = s.y - cam.y;
        if (sx < -100 || sy < -100 || sx > vw+100 || sy > vh+100) return;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(s.rot += 0.4 * (s.kind==='triangle'?1.4:(s.kind==='square'?0.8:0.5)) * 0.016);
        ctx.fillStyle = s.color;
        if (s.kind==='square') { ctx.beginPath(); ctx.rect(-s.r, -s.r, s.r*2, s.r*2); ctx.fill(); }
        else if (s.kind==='triangle') {
          ctx.beginPath(); ctx.moveTo(0, -s.r);
          ctx.lineTo(s.r*0.9, s.r*0.9); ctx.lineTo(-s.r*0.9, s.r*0.9); ctx.closePath(); ctx.fill();
        } else { // pentagon
          ctx.beginPath();
          const n=5; for(let i=0;i<n;i++){ const a = -Math.PI/2 + i*(2*Math.PI/n); const px = Math.cos(a)*s.r; const py = Math.sin(a)*s.r; if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);} ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });

      // player
      ctx.save();
      const px = player.x - cam.x; const py = player.y - cam.y;
      if (cam.shake>0) { cam.shake *= 0.9; ctx.translate((Math.random()-0.5)*cam.shake, (Math.random()-0.5)*cam.shake); }
      ctx.translate(px, py); ctx.rotate(player.angle);
      ctx.fillStyle = 'rgba(122,162,255,0.95)';
      ctx.beginPath(); ctx.rect(-16, -10, 28, 20); ctx.fill();
      ctx.fillStyle = 'rgba(109,243,255,0.9)';
      ctx.beginPath(); ctx.rect(0, -4, 24, 8); ctx.fill();
      ctx.restore();

      // bullets
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      bullets.forEach(b => {
        const bx = b.x - cam.x; const by = b.y - cam.y;
        if (bx < -10 || by < -10 || bx > vw+10 || by > vh+10) return;
        ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI*2); ctx.fill();
      });

      // HUD
      ctx.fillStyle = '#e6e7ea';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText(`Score: ${Math.floor(score)}`, 8, 18);
      ctx.fillText(`HP: ${Math.max(0, Math.floor(player.hp))}/${player.hpMax}`, 8, 36);
      // XP bar
      const barW = 220, barH = 10, bx = 8, by = 48;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = 'rgba(109,243,255,0.8)'; ctx.fillRect(bx, by, (player.xp/player.nextXP)*barW, barH);
      ctx.fillStyle = '#e6e7ea'; ctx.fillText(`Lv ${player.level}  Points: ${player.points}`, bx, by+24);

      if (showUpgrades) {
        ctx.fillStyle = 'rgba(10,12,18,0.8)'; ctx.fillRect(0, 0, vw, vh);
        ctx.fillStyle = '#e6e7ea'; ctx.font = '600 16px Inter, system-ui, sans-serif';
        ctx.fillText('Upgrades (press key):', 20, 40);
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        upgrades.forEach((u, i) => {
          ctx.fillText(`${u.key}. ${u.name}`, 28, 70 + i*22);
        });
        ctx.fillText(`Available points: ${player.points}`, 20, vh - 20);
      }

      if (player.hp <= 0) {
        const end = document.createElement('div');
        Object.assign(end.style, {
          position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
          background: 'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))',
          color: '#e6e7ea', font: '600 18px Inter, system-ui, sans-serif'
        });
        end.textContent = `Round over. Score: ${Math.floor(score)}. Click to close.`;
        body.appendChild(end);
        end.addEventListener('click', () => destroy(), { once: true });
        running = false; return;
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // cleanup
    const originalDestroy = destroy;
    function cleanupAndDestroy() {
      running = false;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('keydown', onUpgradeKey);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      try {
        if (document.fullscreenElement && root.contains(document.fullscreenElement)) {
          document.exitFullscreen?.();
        }
      } catch(_){ }
      document.removeEventListener('fullscreenchange', updateFsLabelArena);
      originalDestroy();
    }
    // eslint-disable-next-line no-func-assign
    destroy = cleanupAndDestroy;

    // Fullscreen button
    const fsBtnArena = document.createElement('button');
    fsBtnArena.type = 'button';
    Object.assign(fsBtnArena.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 2,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    function updateFsLabelArena(){ fsBtnArena.textContent = (document.fullscreenElement === canvas) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabelArena();
    fsBtnArena.addEventListener('click', () => {
      if (document.fullscreenElement === canvas) { document.exitFullscreen?.(); }
      else { canvas.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabelArena);
    body.appendChild(fsBtnArena);
  }

  // --- Mode X: Future Racing (embedded)
  function launchHexGL() {
    const { body, destroy, root } = createEggOverlay('Future Racing');
    const frame = document.createElement('iframe');
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = '0';
    frame.loading = 'eager';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.setAttribute('tabindex', '0');
    body.appendChild(frame);

    // Single source only, with simple timeout feedback
    let loaded = false;
    const status = document.createElement('div');
    Object.assign(status.style, {
      position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
      color: '#e6e7ea', background: 'transparent', font: '600 14px Inter, system-ui, sans-serif'
    });
    status.textContent = 'Loading…';
    body.appendChild(status);

    frame.src = 'https://hexgl.bkcore.com/';
    const to = setTimeout(() => { if (!loaded) status.textContent = 'Could not load. It may be blocked on this network.'; }, 7000);
    frame.onload = () => { loaded = true; clearTimeout(to); try{ status.remove(); }catch(_){} };
    frame.onerror = () => { clearTimeout(to); if (!loaded) status.textContent = 'Could not load. It may be blocked on this network.'; };

    // Fullscreen button (uses modal root to avoid cross-origin constraints)
    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.textContent = 'Fullscreen';
    Object.assign(fsBtn.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 2,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    // allow the embedded experience to enter fullscreen
    try { frame.allowFullscreen = true; frame.setAttribute('allow','fullscreen'); } catch(_) {}
    function updateFsLabel(){ fsBtn.textContent = (document.fullscreenElement === frame) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabel();
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement === frame) { document.exitFullscreen?.(); }
      else { frame.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabel);
    body.appendChild(fsBtn);

    // Cleanup
    const originalDestroy = destroy;
    function cleanup() {
      try { frame.src = 'about:blank'; } catch(_){}
      try { if (document.fullscreenElement === frame) { document.exitFullscreen?.(); } } catch(_){ }
      document.removeEventListener('fullscreenchange', updateFsLabel);
      originalDestroy();
    }
    // eslint-disable-next-line no-func-assign
    destroy = cleanup;
  }

  // --- Mode Y: Trigger Rally (embedded)
  function launchTriggerRally() {
    const { body, destroy, root } = createEggOverlay('Rally Racing');
    const frame = document.createElement('iframe');
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = '0';
    frame.loading = 'eager';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.setAttribute('tabindex', '0');
    body.appendChild(frame);
    // Single source loader with simple feedback
    let loaded = false;
    const status = document.createElement('div');
    Object.assign(status.style, {
      position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
      color: '#e6e7ea', background: 'transparent', font: '600 14px Inter, system-ui, sans-serif'
    });
    status.textContent = 'Loading…';
    body.appendChild(status);

    frame.src = 'https://codeartemis.github.io/TriggerRally/';
    const to = setTimeout(()=>{ if (!loaded) status.textContent = 'Could not load. It may be blocked on this network.'; }, 8000);
    frame.onload = ()=>{ loaded = true; clearTimeout(to); try{ status.remove(); }catch(_){} };
    frame.onerror = ()=>{ clearTimeout(to); if (!loaded) status.textContent = 'Could not load. It may be blocked on this network.'; };

    // Fullscreen button
    const fsBtnRR = document.createElement('button');
    fsBtnRR.type = 'button';
    Object.assign(fsBtnRR.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 2,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    try { frame.allowFullscreen = true; frame.setAttribute('allow','fullscreen'); } catch(_){ }
    function updateFsLabelRR(){ fsBtnRR.textContent = (document.fullscreenElement === frame) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabelRR();
    fsBtnRR.addEventListener('click', () => {
      if (document.fullscreenElement === frame) { document.exitFullscreen?.(); }
      else { frame.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabelRR);
    body.appendChild(fsBtnRR);

    // Cleanup
    const originalDestroy = destroy;
    function cleanup(){
      try { frame.src = 'about:blank'; } catch(_){ }
      try { if (document.fullscreenElement === frame) { document.exitFullscreen?.(); } } catch(_){ }
      document.removeEventListener('fullscreenchange', updateFsLabelRR);
      originalDestroy();
    }
    // eslint-disable-next-line no-func-assign
    destroy = cleanup;
  }

  // --- Mode 4: Connect Four (PvP & vs CPU) ---
  function launchConnectFour() {
    const { body, destroy, root } = createEggOverlay('Connect Four — drop discs to connect 4');
    const canvas = document.createElement('canvas');
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let vw = 700, vh = 560; // viewport for board area

    function resize() {
      const r = body.getBoundingClientRect();
      vw = Math.max(420, Math.floor(Math.min(r.width, 900)));
      vh = Math.max(360, Math.floor(Math.min(r.height, 800)));
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.width = vw + 'px';
      canvas.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      draw();
    }
    const onResize = () => requestAnimationFrame(resize);
    window.addEventListener('resize', onResize);

    // Board setup (7 columns x 6 rows)
    const COLS = 7, ROWS = 6;
    const board = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(0)); // 0 empty, 1 red, 2 yellow
    let current = 1; // active color
    let hoverCol = 3;
    let anims = []; // active piece animations
    let winningLine = null; // {cells:[[c,r],...], color}
    let locked = false; // during animation or end state
    let vsCPU = true;
    let cpuColor = 2; // CPU plays yellow by default
    let cpuThinking = false;
    let lastMoveAt = performance.now();

    // Layout
    const layoutState = { x: 0, y: 0, cell: 0, radius: 0 };
    function layout() {
      const pad = 20;
      const w = vw - pad*2;
      const h = vh - pad*2 - 80; // leave room for HUD
      const cell = Math.floor(Math.min(w / COLS, h / ROWS));
      const boardW = cell * COLS;
      const boardH = cell * ROWS;
      layoutState.x = Math.floor((vw - boardW)/2);
      layoutState.y = Math.floor((vh - boardH)/2) + 20;
      layoutState.cell = cell;
      layoutState.radius = Math.floor(cell * 0.42);
    }

    // HUD controls
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute', left: '12px', right: '12px', top: '8px', zIndex: 2,
      display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between',
    });
    const leftHud = document.createElement('div'); leftHud.style.display='flex'; leftHud.style.gap='8px';
    const rightHud = document.createElement('div'); rightHud.style.display='flex'; rightHud.style.gap='8px';
    const turnEl = document.createElement('div');
    styleHudPill(turnEl);
    const modeBtn = makeHudButton(() => {
      vsCPU = !vsCPU; cpuThinking = false; resetBoard();
      modeBtn.textContent = vsCPU ? 'Mode: vs CPU' : 'Mode: Two Players';
    });
    modeBtn.textContent = 'Mode: vs CPU';
    const swapBtn = makeHudButton(() => { if (!vsCPU) return; cpuColor = cpuColor===1?2:1; resetBoard(); updateTurnText(); });
    swapBtn.textContent = 'CPU: Yellow';
    const diffSel = document.createElement('select');
    Object.assign(diffSel.style, selStyle());
    ;['Easy','Medium','Hard'].forEach((t,i)=>{ const o=document.createElement('option'); o.value=String(i+2); o.textContent=t; diffSel.appendChild(o); });
    diffSel.value = '4'; // Medium depth
    const resetBtn = makeHudButton(() => { resetBoard(); }); resetBtn.textContent = 'Reset';
    leftHud.appendChild(turnEl);
    rightHud.append(modeBtn, swapBtn, diffSel, resetBtn);
    body.appendChild(hud);
    hud.append(leftHud, rightHud);

    function styleHudPill(el){
      Object.assign(el.style, { padding:'6px 10px', border:'1px solid rgba(122,162,255,0.35)', borderRadius:'10px', color:'#e6e7ea', font:'600 13px Inter, system-ui, sans-serif', background:'rgba(0,0,0,0.35)'});
    }
    function makeHudButton(on){ const b=document.createElement('button'); b.type='button'; Object.assign(b.style, btnStyle()); b.addEventListener('click', on); b.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); b.click(); }}); return b; }
    function btnStyle(){ return { appearance:'none', border:'1px solid rgba(122,162,255,0.35)', background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))', color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px', font:'600 13px Inter, system-ui, sans-serif', cursor:'pointer' }; }
    function selStyle(){ return { appearance:'none', border:'1px solid rgba(122,162,255,0.35)', background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))', color:'#e6e7ea', borderRadius:'10px', padding:'6px 8px', font:'600 13px Inter, system-ui, sans-serif' }; }

    function updateTurnText(){
      const who = current===1?'Red':'Yellow';
      turnEl.textContent = `Turn: ${who}${vsCPU? (current===cpuColor?' (CPU)':' (You)') : ''}`;
      swapBtn.textContent = `CPU: ${cpuColor===1?'Red':'Yellow'}`;
    }

    function resetBoard(){
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++) board[c][r]=0;
      current=1; hoverCol=3; anims.length=0; winningLine=null; locked=false; cpuThinking=false; lastMoveAt=performance.now();
      updateTurnText(); draw(); maybeCPUMove();
    }

    // Input
    const onMouseMove = (e)=>{
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - layoutState.x;
      const col = Math.floor(x / layoutState.cell);
      hoverCol = clamp(col, 0, COLS-1);
    };
    const onMouseLeave = ()=>{ hoverCol = -1; };
    const onClick = ()=>{
      if (locked) return;
      if (vsCPU && current===cpuColor) return; // wait for CPU
      dropIn(hoverCol);
    };
    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    document.addEventListener('keydown', (e)=>{
      if (e.key==='ArrowLeft'){ hoverCol = clamp((hoverCol<0?0:hoverCol)-1,0,COLS-1); e.preventDefault(); draw(); }
      else if (e.key==='ArrowRight'){ hoverCol = clamp((hoverCol<0?0:hoverCol)+1,0,COLS-1); e.preventDefault(); draw(); }
      else if (e.key==='Enter' || e.key===' '){ e.preventDefault(); onClick(); }
    });

    function firstEmptyRow(c){ for(let r=ROWS-1;r>=0;r--) if (board[c][r]===0) return r; return -1; }

    function dropIn(c){
      if (c<0||c>=COLS) return; const row = firstEmptyRow(c); if (row<0) return;
      locked = true;
      const startY = -layoutState.cell; const targetY = layoutState.y + row * layoutState.cell + layoutState.cell/2;
      const cx = layoutState.x + c * layoutState.cell + layoutState.cell/2;
      const color = current;
      const anim = { x: cx, y: startY, vy: 0, color, targetY };
      anims.push(anim);
      // animate drop with gravity
      const g = 2200;
      function step(now){
        if (anims.indexOf(anim)===-1) return;
        const dt = 1/60; // fixed for consistency
        anim.vy += g * dt; anim.y += anim.vy * dt;
        if (anim.y >= targetY) {
          anims.splice(anims.indexOf(anim),1);
          // commit piece
          board[c][row] = color;
          lastMoveAt = performance.now();
          const w = checkWin(c, row, color);
          if (w) { winningLine = w; locked = true; draw(); showEnd(`${color===1?'Red':'Yellow'} connects 4! Click to close or Reset.`); return; }
          if (isDraw()) { locked = true; draw(); showEnd('Draw. Click to close or Reset.'); return; }
          current = 3 - color; locked = false; updateTurnText(); draw(); maybeCPUMove(); return;
        }
        draw(); requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function isDraw(){ for(let c=0;c<COLS;c++) if (board[c][0]===0) return false; return true; }

    function checkWin(c, r, color){
      const dirs = [[1,0],[0,1],[1,1],[1,-1]];
      for(const [dx,dy] of dirs){
        const cells = [[c,r]];
        for(let k=1;k<4;k++){ const x=c+dx*k, y=r+dy*k; if(x<0||x>=COLS||y<0||y>=ROWS||board[x][y]!==color) break; cells.push([x,y]); }
        for(let k=1;k<4;k++){ const x=c-dx*k, y=r-dy*k; if(x<0||x>=COLS||y<0||y>=ROWS||board[x][y]!==color) break; cells.unshift([x,y]); }
        if (cells.length>=4) return { cells: cells.slice(0,4), color };
      }
      return null;
    }

    // CPU (minimax with alpha-beta, depth from select)
    function maybeCPUMove(){
      if (!vsCPU || current!==cpuColor || locked) return;
      cpuThinking = true; locked = true; updateTurnText();
      const depth = parseInt(diffSel.value||'4',10);
      setTimeout(()=>{
        const move = bestMove(board, depth, cpuColor);
        cpuThinking = false; locked = false; if (move!=null) dropIn(move); else { // fallback random
          const opts = []; for(let c=0;c<COLS;c++) if(firstEmptyRow(c)>=0) opts.push(c);
          if (opts.length) dropIn(opts[Math.floor(Math.random()*opts.length)]);
        }
      }, Math.max(0, 220 - Math.min(220, performance.now()-lastMoveAt)));
    }

    function bestMove(b, depth, color){
      // returns best column index
      let bestScore = -Infinity, bestC = null; const alphaInit = -Infinity, betaInit = Infinity;
      for(let c=0;c<COLS;c++){
        const r = firstEmpty(b, c); if (r<0) continue;
        b[c][r] = color;
        const score = -negamax(b, depth-1, 3-color, -betaInit, -alphaInit);
        b[c][r] = 0;
        if (score>bestScore){ bestScore=score; bestC=c; }
      }
      return bestC;
    }
    function negamax(b, depth, color, alpha, beta){
      const evalWin = terminalEval(b); if (evalWin!==null) return evalWin * (color===1?1:-1);
      if (depth===0) return heuristic(b, color);
      let best = -Infinity;
      for(const c of orderedCols()){
        const r = firstEmpty(b, c); if (r<0) continue;
        b[c][r] = color;
        const val = -negamax(b, depth-1, 3-color, -beta, -alpha);
        b[c][r] = 0;
        if (val>best) best=val; if (best>alpha) alpha=best; if (alpha>=beta) break;
      }
      return best;
    }
    function orderedCols(){ return [3,2,4,1,5,0,6]; }
    function firstEmpty(b, c){ for(let r=ROWS-1;r>=0;r--) if (b[c][r]===0) return r; return -1; }
    function terminalEval(b){
      // win/loss/draw quick check; return +100000 (red wins), -100000 (yellow wins), 0 for draw, or null
      const w = scanAnyWin(b); if (w===1) return +100000; if (w===2) return -100000; if (isFull(b)) return 0; return null;
    }
    function isFull(b){ for(let c=0;c<COLS;c++) if (b[c][0]===0) return false; return true; }
    function scanAnyWin(b){
      const dirs=[[1,0],[0,1],[1,1],[1,-1]];
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++) if (b[c][r]){
        const color=b[c][r];
        for(const[dx,dy] of dirs){ let cnt=1; for(let k=1;k<4;k++){ const x=c+dx*k,y=r+dy*k; if(x<0||x>=COLS||y<0||y>=ROWS||b[x][y]!==color) break; cnt++; } if (cnt>=4) return color; }
      }
      return 0;
    }
    function heuristic(b, color){
      // score patterns favoring center control and open 2/3 chains
      let score=0; const opp=3-color;
      // center preference
      for(let r=0;r<ROWS;r++){ if (b[3][r]===color) score+=6; else if(b[3][r]===opp) score-=6; }
      // lines
      const dirs=[[1,0],[0,1],[1,1],[1,-1]];
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++) for(const[dx,dy] of dirs){
        let my=0, op=0, empty=0; for(let k=0;k<4;k++){ const x=c+dx*k,y=r+dy*k; if(x<0||x>=COLS||y<0||y>=ROWS){ my=op=5; break;} const v=b[x][y]; if(v===color) my++; else if(v===opp) op++; else empty++; }
        if (op===0) {
          if (my===3 && empty===1) score+=80; else if (my===2 && empty===2) score+=16; else if (my===1 && empty===3) score+=4;
        } else if (my===0) {
          if (op===3 && empty===1) score-=90; else if (op===2 && empty===2) score-=18;
        }
      }
      return score;
    }

    function showEnd(text){
      const end = document.createElement('div');
      Object.assign(end.style, { position:'absolute', inset:'0', display:'grid', placeItems:'center', background:'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))', color:'#e6e7ea', font:'600 18px Inter, system-ui, sans-serif' });
      end.textContent = text;
      body.appendChild(end);
      end.addEventListener('click', ()=> destroy(), { once:true });
    }

    function draw(){
      ctx.clearRect(0,0,vw,vh);
      // background
      ctx.fillStyle = '#0a0c12'; ctx.fillRect(0,0,vw,vh);
      // board frame
      const {x,y,cell,radius} = layoutState;
      const bw = cell*COLS, bh = cell*ROWS;
      // panel
      roundRect(ctx, x-10, y-10, bw+20, bh+20, 14, '#0e0f15', 'rgba(122,162,255,0.18)');
      // holes
      ctx.save();
      ctx.translate(x, y);
      // hover highlight column
      if (hoverCol>=0 && !locked) {
        ctx.fillStyle = 'rgba(122,162,255,0.08)';
        ctx.fillRect(hoverCol*cell, 0, cell, bh);
      }
      // grid holes and discs
      for(let c=0;c<COLS;c++){
        for(let r=0;r<ROWS;r++){
          const cx = c*cell + cell/2; const cy = r*cell + cell/2;
          // hole shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.arc(cx+1, cy+2, radius, 0, Math.PI*2); ctx.fill();
          // piece
          const v = board[c][r]; if (v!==0){ drawDisc(cx, cy, radius, v===1?'#ff6b6b':'#ffd36b'); }
        }
      }
      // active animations
      for(const a of anims){ drawDisc(a.x - x, a.y - y, radius, a.color===1?'#ff6b6b':'#ffd36b'); }
      ctx.restore();

      // highlight winning line
      if (winningLine){
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#6df3ff'; ctx.lineWidth = 6; ctx.shadowColor = '#6df3ff'; ctx.shadowBlur = 10;
        const pts = winningLine.cells.map(([c,r])=>({ px: c*cell+cell/2, py: r*cell+cell/2 }));
        ctx.beginPath(); ctx.moveTo(pts[0].px, pts[0].py); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].px, pts[i].py); ctx.stroke(); ctx.restore();
      }
    }
    function drawDisc(cx, cy, r, color){
      const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.2, cx, cy, r);
      const lighten = color==='#ff6b6b'?'rgba(255,200,200,0.95)':'rgba(255,240,170,0.95)';
      grad.addColorStop(0, lighten); grad.addColorStop(0.4, color); grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    }
    function roundRect(ctx, x, y, w, h, r, fill, stroke){ ctx.save(); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.stroke(); } ctx.restore(); }

    resize();

    // Fullscreen button
    const fsBtnC4 = document.createElement('button');
    fsBtnC4.type = 'button';
    Object.assign(fsBtnC4.style, {
      position: 'absolute', right: '10px', bottom: '10px', zIndex: 3,
      appearance:'none', border:'1px solid rgba(122,162,255,0.35)',
      background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))',
      color:'#e6e7ea', borderRadius:'10px', padding:'6px 10px',
      font:'600 12px Inter, system-ui, sans-serif', cursor:'pointer'
    });
    function updateFsLabelC4(){ fsBtnC4.textContent = (document.fullscreenElement === canvas) ? 'Exit Fullscreen' : 'Fullscreen'; }
    updateFsLabelC4();
    fsBtnC4.addEventListener('click', () => {
      if (document.fullscreenElement === canvas) { document.exitFullscreen?.(); }
      else { canvas.requestFullscreen?.().catch(()=>{}); }
    });
    document.addEventListener('fullscreenchange', updateFsLabelC4);
    body.appendChild(fsBtnC4);

    // cleanup
    const originalDestroy = destroy;
    function cleanupAndDestroy(){
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      try { if (document.fullscreenElement === canvas) { document.exitFullscreen?.(); } } catch(_){ }
      document.removeEventListener('fullscreenchange', updateFsLabelC4);
      originalDestroy();
    }
    // eslint-disable-next-line no-func-assign
    destroy = cleanupAndDestroy;
  }

  // --- Mode 5: Hill Climb Run (2D terrain + car physics) ---
  function launchHillRun(){
    // disabled/hidden by request
    return;
    const { body, destroy } = createEggOverlay('Hill Climb Run — throttle/brake, keep momentum');
    const canvas = document.createElement('canvas'); body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
    let vw=900, vh=560; function resize(){ const r=body.getBoundingClientRect(); vw=Math.max(480,Math.floor(r.width)); vh=Math.max(340,Math.floor(r.height)); canvas.width=Math.floor(vw*dpr); canvas.height=Math.floor(vh*dpr); canvas.style.width=vw+'px'; canvas.style.height=vh+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); } resize(); const onResize=()=>requestAnimationFrame(resize); window.addEventListener('resize', onResize);

    // Simple noise-based terrain
    function rand(seed){ let x=Math.sin(seed)*10000; return x-Math.floor(x); }
    function perlin1(x){ // very light pseudo-noise
      const x0=Math.floor(x), x1=x0+1; const t=x-x0; const fade=t*t*(3-2*t);
      return (hash[x0%hash.length]*(1-fade) + hash[x1%hash.length]*fade);
    }
    const hash = new Array(1024).fill(0).map((_,i)=> (rand(i*13.37)*2-1));
    const world = { len: 20000, scaleX: 28, baseY: 260, amp: 48 };
    function terrainY(X){ const n = perlin1(X/200) * world.amp; const n2 = perlin1(X/54) * 10; return world.baseY - n - n2; }

    // Car physics (chassis + 2 wheels with springs)
    const car = { x: 60, y: terrainY(60)-30, angle: 0, vx: 0, vy: 0, w: 80, h: 22 };
    const rear = { x: -26, y: 12, r: 18, angVel: 0, angle: 0, spin: 0 };
    const front = { x: 26, y: 12, r: 18, angVel: 0, angle: 0, spin: 0 };
    const susp = { k: 1800, d: 28, rest: 14 };
    let throttle=0, brake=0, pitch=0; let fuel=100, dist=0, coins=0, alive=true; let camX=0;
    const keys = new Set();
    const onKeyDown=(e)=>{ keys.add(e.key); if(e.key==='ArrowUp' || e.key==='w' || e.key==='W') throttle=1; if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') brake=1; if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') pitch=-1; if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') pitch=1; if(e.key==='r'||e.key==='R') reset(); };
    const onKeyUp=(e)=>{ keys.delete(e.key); if(['ArrowUp','w','W'].includes(e.key)) throttle=0; if(['ArrowDown','s','S'].includes(e.key)) brake=0; if(['ArrowLeft','a','A'].includes(e.key) && pitch<0) pitch=0; if(['ArrowRight','d','D'].includes(e.key) && pitch>0) pitch=0; };
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

    // Touch controls
    const touchBar = document.createElement('div'); Object.assign(touchBar.style,{ position:'absolute', inset:'auto 0 8px 0', display:'flex', gap:'8px', justifyContent:'center', zIndex:2 });
    const btnL=mkBtn('⟵'); const btnR=mkBtn('⟶'); const btnGo=mkBtn('GO'); const btnBr=mkBtn('■');
    btnL.onpointerdown=()=>{pitch=-1}; btnL.onpointerup=btnL.onpointercancel=()=>{ if(pitch<0)pitch=0; };
    btnR.onpointerdown=()=>{pitch=1}; btnR.onpointerup=btnR.onpointercancel=()=>{ if(pitch>0)pitch=0; };
    btnGo.onpointerdown=()=>{throttle=1}; btnGo.onpointerup=btnGo.onpointercancel=()=>{ throttle=0 };
    btnBr.onpointerdown=()=>{brake=1}; btnBr.onpointerup=btnBr.onpointercancel=()=>{ brake=0 };
    touchBar.append(btnL, btnGo, btnBr, btnR); body.appendChild(touchBar);
    function mkBtn(t){ const b=document.createElement('button'); b.type='button'; b.textContent=t; Object.assign(b.style,{ appearance:'none', border:'1px solid rgba(122,162,255,0.35)', background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))', color:'#e6e7ea', borderRadius:'10px', padding:'10px 14px', font:'700 14px Inter, system-ui, sans-serif' }); b.onpointerdown=b.onpointerup=()=>{}; return b; }

    // Integrator
    let last = performance.now();
    function loop(now){ if(!alive) return; const dt=Math.min(0.032,(now-last)/1000); last=now; step(dt); draw(); requestAnimationFrame(loop); }
    function step(dt){
      fuel = Math.max(0, fuel - (throttle? 5*dt : 1.2*dt)); if (fuel<=0) throttle=0;
      // Wheel world positions
      const cos=Math.cos(car.angle), sin=Math.sin(car.angle);
      const rwx = car.x + rear.x*cos - rear.y*sin; const rwy = car.y + rear.x*sin + rear.y*cos;
      const fwx = car.x + front.x*cos - front.y*sin; const fwy = car.y + front.x*sin + front.y*cos;
      // Terrain contact for each wheel
      function wheelForce(wx, wy, wheel){
        const ty = terrainY(wx);
        // positive penetration means the wheel is inside the ground
        const pen = (wy + wheel.r) - ty;
        if (pen <= 0) {
          // no contact
          return { fx: 0, fy: 0 };
        }
        // spring-damper pushing up
        const Fy = susp.k * (pen + susp.rest) - susp.d * car.vy;
        // traction/drive along x
        const targetSpin = throttle*9 - brake*3;
        wheel.angVel += (targetSpin - wheel.angVel) * 6 * dt;
        // basic friction opposing slip + drive
        const Fx = clamp(wheel.angVel * 180 - car.vx*12, -900, 900);
        return { fx: Fx, fy: -Fy };
      }
      const rf = wheelForce(rwx, rwy, rear); const ff = wheelForce(fwx, fwy, front);
      // Sum forces
      const Fx = rf.fx + ff.fx; const Fy = rf.fy + ff.fy + 980; // gravity downwards
      // integrate (scales tuned for arcade feel)
      car.vx += Fx * dt * 0.0028; car.vy += Fy * dt * 0.0028;
      // rotation by pitch control and slope alignment
      car.angle += (pitch * 1.8 + (Math.atan2(terrainY(car.x+14)-terrainY(car.x-14), 28) - car.angle)*2.2) * dt;
      // integrate
      car.x += car.vx * dt; car.y += car.vy * dt;
      // keep above terrain
      const ground = terrainY(car.x) - 20; if (car.y > ground) { car.y = ground; car.vy *= -0.18; }
      dist = Math.max(dist, car.x);
      camX += ((car.x - vw*0.45) - camX) * 0.12;
      // death condition
      if (car.y > world.baseY + 400) { end('Crashed. Click to close or press R to retry.'); }
    }
    function end(msg){ alive=false; const over=document.createElement('div'); Object.assign(over.style,{ position:'absolute', inset:'0', display:'grid', placeItems:'center', background:'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))', color:'#e6e7ea', font:'600 18px Inter, system-ui, sans-serif' }); over.textContent=msg; body.appendChild(over); over.addEventListener('click', ()=>destroy(), { once:true }); }
    function reset(){ alive=true; fuel=100; dist=0; coins=0; car.x=60; car.y=terrainY(60)-30; car.vx=car.vy=0; car.angle=0; }

    function draw(){
      ctx.clearRect(0,0,vw,vh); ctx.fillStyle='#0a0c12'; ctx.fillRect(0,0,vw,vh);
      // parallax sky
      ctx.fillStyle='rgba(109,243,255,0.06)'; ctx.fillRect(0,0,vh*0.7,vh*0.7);
      // terrain
      ctx.save(); ctx.translate(-camX, 0);
      ctx.strokeStyle='rgba(122,162,255,0.35)'; ctx.lineWidth=2; ctx.beginPath();
      for(let x= -40 + Math.floor(camX); x<camX+vw+40; x+=4){ const y=terrainY(x); if(x===-40+Math.floor(camX)) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke();
      // car
      ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
      // chassis
      ctx.fillStyle='rgba(122,162,255,0.9)'; ctx.fillRect(-car.w/2, -car.h/2, car.w, car.h);
      // wheels
      ctx.fillStyle='#e6e7ea'; ctx.beginPath(); ctx.arc(rear.x, rear.y, rear.r, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(front.x, front.y, front.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.restore();
      // HUD
      ctx.fillStyle='#e6e7ea'; ctx.font='600 14px Inter, system-ui, sans-serif'; ctx.fillText(`Fuel: ${fuel.toFixed(0)}%`, 8, 18); ctx.fillText(`Distance: ${Math.floor(dist)}m`, 8, 36);
    }
    requestAnimationFrame(loop);

    // cleanup
    const originalDestroy=destroy; function cleanup(){ document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', onResize); originalDestroy(); }
    // eslint-disable-next-line no-func-assign
    destroy = cleanup;
  }

  // --- Mode 6: Wheelie Balance (fast road wheelie challenge) ---
  function launchWheelie(){
    // disabled/hidden by request
    return;
    const { body, destroy } = createEggOverlay('Wheelie Balance — hold a wheelie and go the distance');
    const canvas=document.createElement('canvas'); body.appendChild(canvas); const ctx=canvas.getContext('2d');
    let dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1)); let vw=800,vh=480; function resize(){ const r=body.getBoundingClientRect(); vw=Math.max(420,Math.floor(r.width)); vh=Math.max(320,Math.floor(r.height)); canvas.width=Math.floor(vw*dpr); canvas.height=Math.floor(vh*dpr); canvas.style.width=vw+'px'; canvas.style.height=vh+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);} resize(); const onResize=()=>requestAnimationFrame(resize); window.addEventListener('resize', onResize);

    // Road profile: mostly flat, gentle bumps for interest
    function roadY(x){ return vh-90 + Math.sin(x*0.008)*6 + Math.sin(x*0.021+1.3)*3; }

    const bike={ x:80, y:roadY(80)-16, angle:0, angVel:0, vx:0, vy:0, len:100 };
    const controls={ acc:0, brake:0, lean:0 };
    const keys=new Set(); const onKeyDown=(e)=>{ keys.add(e.key); if(['ArrowUp','w','W'].includes(e.key)) controls.acc=1; if(['ArrowDown','s','S'].includes(e.key)) controls.brake=1; if(['ArrowLeft','a','A'].includes(e.key)) controls.lean=-1; if(['ArrowRight','d','D'].includes(e.key)) controls.lean=1; if(e.key==='r'||e.key==='R') reset(); }; const onKeyUp=(e)=>{ keys.delete(e.key); if(['ArrowUp','w','W'].includes(e.key)) controls.acc=0; if(['ArrowDown','s','S'].includes(e.key)) controls.brake=0; if(['ArrowLeft','a','A'].includes(e.key) && controls.lean<0) controls.lean=0; if(['ArrowRight','d','D'].includes(e.key) && controls.lean>0) controls.lean=0; };
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

    // Touch controls
    const touchBar = document.createElement('div'); Object.assign(touchBar.style,{ position:'absolute', inset:'auto 0 8px 0', display:'flex', gap:'8px', justifyContent:'center', zIndex:2 });
    const btnLeanL=mkBtn('⟵'); const btnLeanR=mkBtn('⟶'); const btnGo=mkBtn('GO'); const btnBr=mkBtn('■');
    btnLeanL.onpointerdown=()=>{controls.lean=-1}; btnLeanL.onpointerup=btnLeanL.onpointercancel=()=>{ if(controls.lean<0)controls.lean=0; };
    btnLeanR.onpointerdown=()=>{controls.lean=1}; btnLeanR.onpointerup=btnLeanR.onpointercancel=()=>{ if(controls.lean>0)controls.lean=0; };
    btnGo.onpointerdown=()=>{controls.acc=1}; btnGo.onpointerup=btnGo.onpointercancel=()=>{ controls.acc=0 };
    btnBr.onpointerdown=()=>{controls.brake=1}; btnBr.onpointerup=btnBr.onpointercancel=()=>{ controls.brake=0 };
    touchBar.append(btnLeanL, btnGo, btnBr, btnLeanR); body.appendChild(touchBar);
    function mkBtn(t){ const b=document.createElement('button'); b.type='button'; b.textContent=t; Object.assign(b.style,{ appearance:'none', border:'1px solid rgba(122,162,255,0.35)', background:'linear-gradient(180deg, rgba(17,19,27,0.8), rgba(13,15,22,0.8))', color:'#e6e7ea', borderRadius:'10px', padding:'10px 14px', font:'700 14px Inter, system-ui, sans-serif' }); return b; }

    // Scoring: hold front wheel off the ground; combo increases with continuous wheelie
    let dist=0, bestDist=0, score=0, bestScore=0, wheelieTime=0, camX=0, alive=true;
    let last=performance.now(); function loop(now){ if(!alive) return; const dt=Math.min(0.032,(now-last)/1000); last=now; step(dt); draw(); requestAnimationFrame(loop); }

    function step(dt){
      const torque = controls.acc*28 - controls.brake*10 + controls.lean*36;
      bike.angVel += (torque - Math.sin(bike.angle)*22) * dt; bike.angVel *= 0.986; bike.angle += bike.angVel * dt;
      // forward speed
      bike.vx += (controls.acc*120 - controls.brake*80) * dt; bike.vx = clamp(bike.vx, 60, 420); bike.x += bike.vx * dt;
      // keep rear wheel near road
      const rearWorld = wheelPos(-0.4); // back contact factor
      const ry = roadY(rearWorld.x);
      if (rearWorld.y < ry) {
        const dy = ry - rearWorld.y; bike.y += dy; bike.vy = 0; // snap up softly
      } else {
        bike.vy += 900*dt; bike.y += bike.vy*dt; // gravity if airborne
      }

      // determine front wheel contact
      const frontWorld = wheelPos(0.4);
      const fy = roadY(frontWorld.x);
      const frontClear = frontWorld.y < fy - 1; // front above road

      // scoring: accumulate time while front wheel is up
      if (frontClear) {
        wheelieTime += dt;
        score += dt * (1 + bike.vx/200); // faster = more points
      } else {
        // touching the front ends the round (wheelie challenge)
        end(`Front wheel touched down. Distance: ${Math.floor(dist)}m  •  Score: ${Math.floor(score)}. Click to close or press R to retry.`);
      }

      // tip over condition
      if (bike.angle < -1.2 || bike.angle > 1.2) {
        end(`Tipped over. Distance: ${Math.floor(dist)}m  •  Score: ${Math.floor(score)}. Click to close or press R to retry.`);
      }

      dist = Math.max(dist, bike.x);
      bestDist = Math.max(bestDist, dist);
      bestScore = Math.max(bestScore, score);
      camX += ((bike.x - vw*0.45) - camX) * 0.12;
    }

    function wheelPos(sign){ // sign -0.4 rear, +0.4 front factor along bike length
      const r = bike.len*0.5; const dx = Math.cos(bike.angle)*r*sign; const dy = Math.sin(bike.angle)*r*sign;
      return { x: bike.x + dx, y: bike.y + dy + 12 };
    }

    function end(msg){
      if(!alive) return; alive=false;
      const over=document.createElement('div'); Object.assign(over.style,{ position:'absolute', inset:'0', display:'grid', placeItems:'center', background:'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))', color:'#e6e7ea', font:'600 18px Inter, system-ui, sans-serif', textAlign:'center', padding:'20px' }); over.textContent=msg; body.appendChild(over); over.addEventListener('click', ()=>destroy(), { once:true });
    }
    function reset(){ alive=true; bike.x=80; bike.y=roadY(80)-16; bike.vx=120; bike.vy=0; bike.angle=0; bike.angVel=0; dist=0; score=0; wheelieTime=0; }

    function draw(){
      ctx.clearRect(0,0,vw,vh); ctx.fillStyle='#0a0c12'; ctx.fillRect(0,0,vw,vh);
      // road
      ctx.save(); ctx.translate(-camX,0);
      ctx.strokeStyle='rgba(122,162,255,0.35)'; ctx.lineWidth=2; ctx.beginPath();
      ctx.moveTo(-200, roadY(-200));
      for(let x=-200+Math.floor(camX); x<camX+vw+200; x+=8){ ctx.lineTo(x, roadY(x)); }
      ctx.stroke();

      // bike
      const rear = wheelPos(-0.4); const front = wheelPos(0.4);
      ctx.save(); ctx.translate(bike.x, bike.y); ctx.rotate(bike.angle);
      ctx.fillStyle='rgba(122,162,255,0.9)'; ctx.fillRect(-30,-6,60,12);
      ctx.beginPath(); ctx.fillStyle='#e6e7ea'; ctx.arc(-bike.len*0.2, 12, 16, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(bike.len*0.2, 12, 16, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.restore();

      // HUD
      ctx.fillStyle='#e6e7ea'; ctx.font='600 14px Inter, system-ui, sans-serif';
      ctx.fillText(`Distance: ${Math.floor(dist)}m (Best ${Math.floor(bestDist)}m)`, 8, 18);
      ctx.fillText(`Score: ${Math.floor(score)} (Best ${Math.floor(bestScore)})`, 8, 36);
      ctx.fillText(`Wheelie time: ${wheelieTime.toFixed(1)}s`, 8, 54);
    }
    requestAnimationFrame(loop);

    const originalDestroy=destroy; function cleanup(){ document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', onResize); touchBar.remove(); originalDestroy(); } // eslint-disable-next-line no-func-assign
    destroy = cleanup;
  }

  // --- Mode 7: Helix Jump (3D tower with real shading) ---
  function launchHelixJump(){
    // disabled/hidden by request
    return;
    const { body, destroy } = createEggOverlay('Helix Jump — rotate with ←/→ or drag');
    // container for WebGL
    const root = document.createElement('div');
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = '100%';
    body.appendChild(root);

    // Dynamic loader for Three.js (global THREE) with multi-CDN fallback
    function loadThree() {
      if (window.THREE) return Promise.resolve(window.THREE);

      const sources = [
        // If you later add a local copy, this will be attempted first
        '/vendor/three.min.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
        'https://unpkg.com/three@0.160.0/build/three.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js'
      ];

      function loadScript(src, timeoutMs = 7000) {
        return new Promise((resolve, reject) => {
          const el = document.createElement('script');
          el.src = src;
          el.async = true;
          let done = false;
          const clear = () => { done = true; el.onload = null; el.onerror = null; };
          const to = setTimeout(() => {
            if (done) return; clear(); reject(new Error('timeout'));
          }, timeoutMs);
          el.onload = () => { if (done) return; clearTimeout(to); clear(); resolve(); };
          el.onerror = () => { if (done) return; clearTimeout(to); clear(); reject(new Error('load error')); };
          document.head.appendChild(el);
        });
      }

      let chain = Promise.reject();
      for (const src of sources) {
        chain = chain.catch(() => loadScript(src).then(() => {
          if (!window.THREE) throw new Error('THREE missing after load');
          return window.THREE;
        }));
      }
      return chain;
    }

    let renderer, scene, camera, hemi, dir, raf = 0, running = true;
    let vw = 800, vh = 560, dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));

    // Tower/level data (shared with collision)
    const TAU = Math.PI * 2;
    const tower = { rot: 0, rotVel: 0 };
    const ringGap = 3.6; // world units between rings
    const innerR = 1.3, outerR = 2.6;
    const totalRings = 160;
    const rings = []; // { y, gaps:[{a0,a1}], danger:[{a0,a1}] }
    const rng = (a,b)=> a + Math.random()*(b-a);
    function arcContains(a0,a1,x){
      const n=(v)=>{ v%=TAU; return v<0?v+TAU:v; }; a0=n(a0); a1=n(a1); x=n(x);
      return a0<=a1 ? (x>=a0 && x<=a1) : (x>=a0 || x<=a1);
    }
    function angleOverlap(a0,a1,b0,b1){
      const samples=8; for(let i=0;i<=samples;i++){ const t=i/samples; const aa = a0 + (a1-a0)*t; const bb = b0 + (b1-b0)*t; if (arcContains(a0,a1,bb) || arcContains(b0,b1,aa)) return true; } return false;
    }
    function addRing(i){
      const y = i * ringGap;
      const gaps = [];
      const gapCount = Math.random()<0.25?3:(Math.random()<0.6?2:1);
      for(let g=0; g<gapCount; g++){
        const w = rng(TAU*0.23, TAU*0.48);
        let a0 = rng(0, TAU);
        let tries=0; while(tries++<20 && gaps.some(u=>angleOverlap(u.a0,u.a1,a0,a0+w))) a0 = rng(0,TAU);
        gaps.push({ a0, a1:a0+w });
      }
      const danger = [];
      if (i>2){
        const c = Math.random()<0.5?1:2;
        for(let k=0;k<c;k++){
          const w = rng(TAU*0.14, TAU*0.3);
          let a0 = rng(0, TAU);
          let tries=0; while(tries++<20 && (gaps.some(u=>angleOverlap(u.a0,u.a1,a0,a0+w)))) a0 = rng(0,TAU);
          danger.push({ a0, a1:a0+w });
        }
      }
      rings.push({ y, gaps, danger });
    }
    for(let i=0;i<totalRings;i++) addRing(i);

    // HUD
    const hud = document.createElement('div');
    Object.assign(hud.style, { position:'absolute', left:'10px', top:'8px', zIndex:2, display:'flex', gap:'10px' });
    const pill = (txt)=>{ const d=document.createElement('div'); Object.assign(d.style,{ padding:'6px 10px', border:'1px solid rgba(122,162,255,0.35)', borderRadius:'10px', color:'#e6e7ea', background:'rgba(0,0,0,0.35)', font:'600 13px Inter, system-ui, sans-serif' }); d.textContent=txt; return d; };
    const scoreEl = pill('Score: 0'); const bestEl = pill('Best: 0'); hud.append(scoreEl,bestEl); root.appendChild(hud);
    let score = 0; let best = parseInt(localStorage.getItem('hx_best')||'0',10)||0; bestEl.textContent = `Best: ${best}`;
    const passed = new Set();

    // Ball state
    const ball = { x: 0, y: -2, z: 0, vy: 0, r: 0.32 };

    // Input
    const keys = new Set();
    const onKeyDown = (e)=>{ keys.add(e.key); if(e.key==='r'||e.key==='R') reset(); };
    const onKeyUp = (e)=>{ keys.delete(e.key); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    let dragging=false, lastX=0;
    const onPointerDown = (e)=>{ dragging=true; lastX=(e.touches?e.touches[0].clientX:e.clientX)||0; };
    const onPointerMove = (e)=>{
      if(!dragging) return;
      const x=(e.touches?e.touches[0].clientX:e.clientX)||lastX; const dx=x-lastX; lastX=x; tower.rotVel += dx*0.0025;
    };
    const onPointerUp = ()=>{ dragging=false; };

    function reset(){ score=0; scoreEl.textContent='Score: 0'; passed.clear(); ball.x=0; ball.z=0; ball.y=-2; ball.vy=0; tower.rot=0; tower.rotVel=0; last=performance.now(); }

    // Build 3D scene
    loadThree().then((THREE)=>{
      if (!running) return;
      // Basic WebGL support check
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) throw new Error('WebGL not available');
      } catch (_) {
        // Fallback to a lightweight 2D renderer if WebGL is not available
        runHelixCanvasFallback();
        return;
      }
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0c12);
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
      camera.position.set(0, 2.6, 6.6);
      camera.lookAt(0, 0, 0);

      // Lights
      hemi = new THREE.HemisphereLight(0xa9c6ff, 0x0b0d14, 0.85);
      scene.add(hemi);
      dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(3, 6, 4);
      scene.add(dir);

      // Subtle fog for depth
      scene.fog = new THREE.Fog(0x0a0c12, 20, 120);

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(dpr);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      root.appendChild(renderer.domElement);

      // Tower group
      const towerGroup = new THREE.Group();
      scene.add(towerGroup);

      // Materials
      const segMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('rgb(150,170,255)'), metalness: 0.25, roughness: 0.35, emissive: new THREE.Color('rgb(40,60,120)'), emissiveIntensity: 0.06 });
      const hazMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('rgb(255,110,110)'), metalness: 0.15, roughness: 0.6, emissive: new THREE.Color('rgb(120,20,20)'), emissiveIntensity: 0.08 });
      const bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.06, transparent: true });

      // Geometry builder: create ring segments as thin boxes around a circle, skipping gaps
      const segGeom = new THREE.BoxGeometry(0.24, 0.22, outerR - innerR);
      segGeom.translate(0.12, 0, innerR + (outerR-innerR)/2);

      // Build multiple instanced meshes per ring band for efficiency
      const segGroup = new THREE.Group();
      const hazGroup = new THREE.Group();
      const bgGroup = new THREE.Group();
      towerGroup.add(bgGroup, segGroup, hazGroup);

      // Background faint full rings (for depth cues)
      (function buildBackgroundRings(){
        const torusGeom = new THREE.TorusGeometry((innerR+outerR)/2, (outerR-innerR)/2, 16, 64);
        for(let i=0;i<totalRings;i+=5){
          const m = new THREE.Mesh(torusGeom, bgMat);
          m.position.y = i*ringGap;
          bgGroup.add(m);
        }
      })();

      // Build solid segments
      const tmp = new THREE.Object3D();
      for(let i=0;i<totalRings;i++){
        const ring = rings[i];
        // build complementary segments covering [0,2π) \ gaps
        const gs = ring.gaps.map(g=>({ a0: ((g.a0%TAU)+TAU)%TAU, a1: ((g.a1%TAU)+TAU)%TAU })).sort((a,b)=>a.a0-b.a0);
        const spans = [];
        let cursor = 0;
        for(const g of gs){ const a0=cursor, a1=g.a0; if (((a1 - a0 + TAU)%TAU) > 0.08) spans.push({ a0, a1 }); cursor = g.a1; }
        if (((TAU - cursor + TAU)%TAU) > 0.08) spans.push({ a0: cursor, a1: TAU });

        const segs = Math.max(10, Math.floor(64 * (1 - Math.random()*0.2))); // granularity
        const segInst = new THREE.InstancedMesh(segGeom, segMat, spans.length * segs);
        segInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        let n = 0;
        for(const s of spans){
          for(let k=0;k<segs;k++){
            const t = k/segs; const ang = s.a0 + (s.a1 - s.a0)*t;
            tmp.position.set(0, ring.y, 0);
            tmp.rotation.set(0, ang, 0);
            tmp.updateMatrix();
            segInst.setMatrixAt(n++, tmp.matrix);
          }
        }
        segInst.userData.level = i;
        segGroup.add(segInst);

        // hazard arcs: place a few thicker boxes
        const hazCount = ring.danger.length * 8;
        if (hazCount>0){
          const hzGeom = new THREE.BoxGeometry(0.28, 0.24, outerR - innerR);
          hzGeom.translate(0.14, 0, innerR + (outerR-innerR)/2);
          const hazInst = new THREE.InstancedMesh(hzGeom, hazMat, hazCount);
          let m=0;
          for(const d of ring.danger){
            for(let k=0;k<8;k++){
              const t = k/8; const ang = d.a0 + (d.a1 - d.a0)*t;
              tmp.position.set(0, ring.y, 0);
              tmp.rotation.set(0, ang, 0);
              tmp.updateMatrix();
              hazInst.setMatrixAt(m++, tmp.matrix);
            }
          }
          hazInst.userData.level = i;
          hazGroup.add(hazInst);
        }
      }

      // Ball mesh
      const sphereGeom = new THREE.SphereGeometry(ball.r, 32, 16);
      const ballMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('rgb(140,200,255)'), roughness: 0.25, metalness: 0.35, envMapIntensity: 0.9 });
      const ballMesh = new THREE.Mesh(sphereGeom, ballMat);
      ballMesh.castShadow = false;
      scene.add(ballMesh);

      // Resize
      function resize(){
        const r = body.getBoundingClientRect();
        vw = Math.max(420, Math.floor(r.width));
        vh = Math.max(360, Math.floor(r.height));
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
        renderer.setPixelRatio(dpr);
        renderer.setSize(vw, vh, false);
        camera.aspect = vw/vh; camera.updateProjectionMatrix();
      }
      const onResize = () => requestAnimationFrame(resize);
      window.addEventListener('resize', onResize);
      resize();

      // Events for rotation control
      renderer.domElement.addEventListener('mousedown', onPointerDown);
      renderer.domElement.addEventListener('mousemove', onPointerMove, { passive:true });
      window.addEventListener('mouseup', onPointerUp);
      renderer.domElement.addEventListener('touchstart', onPointerDown, { passive:true });
      renderer.domElement.addEventListener('touchmove', onPointerMove, { passive:true });
      renderer.domElement.addEventListener('touchend', onPointerUp);
      renderer.domElement.addEventListener('touchcancel', onPointerUp);

      // Animation loop
      let last = performance.now();
      function tick(now){
        if (!running) return;
        const dt = Math.min(0.033, (now-last)/1000); last = now;

        // controls
        const accel = 0.08;
        if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) tower.rotVel -= accel;
        if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) tower.rotVel += accel;
        tower.rotVel *= 0.96; tower.rot += tower.rotVel * dt * 6;
        towerGroup.rotation.y = tower.rot;

        // camera follow
        const targetCamY = ball.y + 2.2; // keep ball lower in view
        camera.position.y += (targetCamY - camera.position.y) * 0.1;
        camera.lookAt(0, ball.y, 0);

        // physics
        ball.vy += 18 * dt; // gravity in world units
        ball.y += ball.vy * dt;

        // scoring when crossing ring height
        const idx = Math.floor(ball.y / ringGap);
        if (idx>=0 && idx<rings.length) {
          if (!passed.has(idx) && ball.vy>0 && (ball.y - ball.vy*dt) < idx*ringGap && ball.y >= idx*ringGap){
            passed.add(idx); score += 1; scoreEl.textContent = `Score: ${score}`;
          }
        }

        // collision against current and nearby rings
        for(let j=-1;j<=1;j++){
          const ridx = Math.floor((ball.y + j*ringGap*0.3)/ringGap);
          if (ridx<0 || ridx>=rings.length) continue;
          const ring = rings[ridx]; const planeY = ring.y;
          const dy = ball.y - planeY;
          if (dy > -0.05 && dy < ball.r*0.9 && ball.vy > 0){
            // world angle of tower seam is tower.rot; we check if that angle is a gap; since ball is centered, angle reference is tower rotation
            const theta = ((tower.rot%TAU)+TAU)%TAU;
            const inGap = ring.gaps.some(g => arcContains(g.a0, g.a1, theta));
            if (!inGap){
              const hazardHit = ring.danger.some(d => arcContains(d.a0, d.a1, theta));
              if (hazardHit){ return end(`Hit a hazard. Score: ${score}. Click to close.`); }
              ball.vy = -Math.max(8, ball.vy*0.55);
              ball.y = planeY - (ball.r+0.04);
            }
          }
        }

        // update ball mesh
        ballMesh.position.set(ball.x, ball.y, ball.z);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      // close & cleanup
      const originalDestroy = destroy;
      function cleanup(){
        running = false;
        best = Math.max(best, score); try{ localStorage.setItem('hx_best', String(best)); }catch(_){}
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        if (renderer){
          window.removeEventListener('resize', onResize);
          renderer.domElement.removeEventListener('mousedown', onPointerDown);
          renderer.domElement.removeEventListener('mousemove', onPointerMove);
          window.removeEventListener('mouseup', onPointerUp);
          renderer.domElement.removeEventListener('touchstart', onPointerDown);
          renderer.domElement.removeEventListener('touchmove', onPointerMove);
          renderer.domElement.removeEventListener('touchend', onPointerUp);
          renderer.domElement.removeEventListener('touchcancel', onPointerUp);
        }
        if (raf) cancelAnimationFrame(raf);
        try {
          // dispose
          scene.traverse((o)=>{
            if (o.geometry) o.geometry.dispose?.();
            if (o.material){ if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.()); else o.material.dispose?.(); }
          });
          renderer.dispose?.();
        } catch(_){}
        root.remove();
        originalDestroy();
      }
      // eslint-disable-next-line no-func-assign
      destroy = cleanup;
    }).catch((err) => {
      // If Three.js fails to load (e.g., CDN blocked), run 2D fallback instead of showing only a message
      runHelixCanvasFallback((''+err));
    });

    // 2D Canvas fallback for Helix when 3D cannot initialize
    function runHelixCanvasFallback(errorMsg){
      const canvas = document.createElement('canvas');
      root.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      let dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
      let vw = 800, vh = 560;
      function resize(){
        const r = body.getBoundingClientRect();
        vw = Math.max(420, Math.floor(r.width));
        vh = Math.max(360, Math.floor(r.height));
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
        canvas.width = Math.floor(vw*dpr);
        canvas.height = Math.floor(vh*dpr);
        canvas.style.width = vw+'px';
        canvas.style.height = vh+'px';
        ctx.setTransform(dpr,0,0,dpr,0,0);
      }
      const onResize = () => requestAnimationFrame(resize);
      window.addEventListener('resize', onResize);
      resize();

      // simple tower model similar to 3D data
      const TAU = Math.PI*2;
      const ringGap = 52; // px between rings
      const innerR = 64, outerR = 130;
      const totalRings = 120;
      const rings = [];
      const rng=(a,b)=>a+Math.random()*(b-a);
      function arcContains(a0,a1,x){
        const n=(v)=>{ v%=TAU; return v<0?v+TAU:v; }; a0=n(a0); a1=n(a1); x=n(x);
        return a0<=a1 ? (x>=a0 && x<=a1) : (x>=a0 || x<=a1);
      }
      function angleOverlap(a0,a1,b0,b1){ const samples=8; for(let i=0;i<=samples;i++){ const t=i/samples; const aa=a0+(a1-a0)*t; const bb=b0+(b1-b0)*t; if(arcContains(a0,a1,bb)||arcContains(b0,b1,aa)) return true;} return false; }
      function addRing(i){
        const y=i*ringGap;
        const gaps=[]; const gapCount = Math.random()<0.25?3:(Math.random()<0.6?2:1);
        for(let g=0; g<gapCount; g++){ const w=rng(TAU*0.22, TAU*0.45); let a0=rng(0,TAU); let tries=0; while(tries++<20 && gaps.some(u=>angleOverlap(u.a0,u.a1,a0,a0+w))) a0=rng(0,TAU); gaps.push({a0,a1:a0+w}); }
        const danger=[]; if(i>2){ const c=Math.random()<0.5?1:2; for(let k=0;k<c;k++){ const w=rng(TAU*0.14,TAU*0.28); let a0=rng(0,TAU); let tries=0; while(tries++<20 && gaps.some(u=>angleOverlap(u.a0,u.a1,a0,a0+w))) a0=rng(0,TAU); danger.push({a0,a1:a0+w}); } }
        rings.push({y,gaps,danger});
      }
      for(let i=0;i<totalRings;i++) addRing(i);

      const hud = document.createElement('div');
      Object.assign(hud.style, { position:'absolute', left:'10px', top:'8px', zIndex:2, display:'flex', gap:'10px' });
      const pill = (txt)=>{ const d=document.createElement('div'); Object.assign(d.style,{ padding:'6px 10px', border:'1px solid rgba(122,162,255,0.35)', borderRadius:'10px', color:'#e6e7ea', background:'rgba(0,0,0,0.35)', font:'600 13px Inter, system-ui, sans-serif' }); d.textContent=txt; return d; };
      const scoreEl = pill('Score: 0'); const bestEl = pill('Best: 0');
      const msg = errorMsg ? pill('Using fallback') : null; if (msg) { msg.style.opacity='0.7'; }
      hud.append(scoreEl,bestEl); if(msg) hud.append(msg);
      root.appendChild(hud);
      let score=0; let best=parseInt(localStorage.getItem('hx_best2d')||'0',10)||0; bestEl.textContent=`Best: ${best}`;
      const passed = new Set();

      const ball = { x: 0, y: -ringGap*0.5, vy: 0, r: 12 };
      let rot=0, rotVel=0; let running=true; let raf=0; let last=performance.now();
      const keys=new Set();
      const onKeyDown=(e)=>{ keys.add(e.key); if(e.key==='r'||e.key==='R'){ reset(); }};
      const onKeyUp=(e)=>{ keys.delete(e.key); };
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      let dragging=false, lastX=0;
      const onPointerDown=(e)=>{ dragging=true; lastX=(e.touches?e.touches[0].clientX:e.clientX)||0; };
      const onPointerMove=(e)=>{ if(!dragging) return; const x=(e.touches?e.touches[0].clientX:e.clientX)||lastX; const dx=x-lastX; lastX=x; rotVel += dx*0.0025; };
      const onPointerUp=()=>{ dragging=false; };
      canvas.addEventListener('mousedown', onPointerDown);
      canvas.addEventListener('mousemove', onPointerMove, { passive:true });
      window.addEventListener('mouseup', onPointerUp);
      canvas.addEventListener('touchstart', onPointerDown, { passive:true });
      canvas.addEventListener('touchmove', onPointerMove, { passive:true });
      canvas.addEventListener('touchend', onPointerUp);
      canvas.addEventListener('touchcancel', onPointerUp);

      function reset(){ score=0; scoreEl.textContent='Score: 0'; passed.clear(); ball.x=0; ball.y=-ringGap*0.5; ball.vy=0; rot=0; rotVel=0; last=performance.now(); }

      function drawRing(cx,cy,inner,outer,theta,ring){
        // draw full ring faint
        ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=outer-inner; ctx.beginPath(); ctx.arc(cx,cy, (inner+outer)/2, 0, TAU); ctx.stroke();
        // draw solid arcs (complement of gaps)
        ctx.lineWidth=outer-inner;
        ctx.strokeStyle='rgba(150,170,255,0.85)';
        // Build spans
        const gs = ring.gaps.map(g=>({a0:((g.a0%TAU)+TAU)%TAU,a1:((g.a1%TAU)+TAU)%TAU})).sort((a,b)=>a.a0-b.a0);
        const spans=[]; let cursor=0;
        for(const g of gs){ const a0=cursor, a1=g.a0; const span=(a1-a0+TAU)%TAU; if (span>0.06) spans.push({a0,a1}); cursor=g.a1; }
        const tail=(TAU-cursor+TAU)%TAU; if (tail>0.06) spans.push({a0:cursor,a1:TAU});
        for(const s of spans){ ctx.beginPath(); ctx.arc(cx,cy,(inner+outer)/2, s.a0+theta, s.a1+theta); ctx.stroke(); }
        // hazards
        ctx.strokeStyle='rgba(255,110,110,0.9)';
        for(const d of ring.danger){ ctx.beginPath(); ctx.arc(cx,cy,(inner+outer)/2, d.a0+theta, d.a1+theta); ctx.stroke(); }
      }

      function tick(now){
        if(!running) return; const dt=Math.min(0.033,(now-last)/1000); last=now;
        // controls
        const accel=0.08; if(keys.has('ArrowLeft')||keys.has('a')||keys.has('A')) rotVel-=accel; if(keys.has('ArrowRight')||keys.has('d')||keys.has('D')) rotVel+=accel; rotVel*=0.96; rot+=rotVel*dt*6;
        // physics
        ball.vy += 180*dt; ball.y += ball.vy*dt; // gravity px/s^2

        // scoring
        const idx=Math.floor(ball.y/ringGap); if(idx>=0 && idx<rings.length){ if(!passed.has(idx) && ball.vy>0 && (ball.y - ball.vy*dt) < idx*ringGap && ball.y>=idx*ringGap){ passed.add(idx); score+=1; scoreEl.textContent = `Score: ${score}`; } }

        // collisions with ring planes
        for(let j=-1;j<=1;j++){
          const ridx=Math.floor((ball.y + j*ringGap*0.3)/ringGap); if(ridx<0||ridx>=rings.length) continue; const ring=rings[ridx]; const planeY=ridx*ringGap;
          const dy = ball.y - planeY; if(dy > -4 && dy < ball.r && ball.vy > 0){
            const theta = ((rot%TAU)+TAU)%TAU;
            const inGap = ring.gaps.some(g=>arcContains(g.a0,g.a1,theta));
            if(!inGap){
              const hazard = ring.danger.some(d=>arcContains(d.a0,d.a1,theta));
              if(hazard){ end(); return; }
              ball.vy = -Math.max(160, ball.vy*0.55); ball.y = planeY - (ball.r+1);
            }
          }
        }

        // draw
        ctx.clearRect(0,0,vw,vh); ctx.fillStyle='#0a0c12'; ctx.fillRect(0,0,vw,vh);
        const cx = Math.floor(vw/2), cy = Math.floor(vh*0.2);
        // draw a stack of rings around the ball for performance
        const start = Math.max(0, Math.floor(ball.y/ringGap)-6);
        const end = Math.min(rings.length-1, start+18);
        for(let i=start;i<=end;i++){
          const ry = cy + (i*ringGap - ball.y); if(ry < -outerR || ry > vh + outerR) continue; drawRing(cx, ry, innerR, outerR, rot, rings[i]);
        }
        // ball
        ctx.fillStyle='rgba(140,200,255,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, ball.r, 0, TAU); ctx.fill();

        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      function end(){ running=false; best=Math.max(best,score); try{ localStorage.setItem('hx_best2d', String(best)); }catch(_){}; const over=document.createElement('div'); Object.assign(over.style,{ position:'absolute', inset:'0', display:'grid', placeItems:'center', background:'linear-gradient(180deg, rgba(10,12,18,0.2), rgba(10,12,18,0.6))', color:'#e6e7ea', font:'600 18px Inter, system-ui, sans-serif', textAlign:'center', padding:'20px' }); over.textContent=`Round over. Score: ${score}. Click to close.`; root.appendChild(over); over.addEventListener('click', ()=>destroy(), { once:true }); }

      // cleanup on overlay close
      const originalDestroy = destroy;
      function cleanup(){ running=false; if(raf) cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.removeEventListener('mousedown', onPointerDown); canvas.removeEventListener('mousemove', onPointerMove); window.removeEventListener('mouseup', onPointerUp); canvas.removeEventListener('touchstart', onPointerDown); canvas.removeEventListener('touchmove', onPointerMove); canvas.removeEventListener('touchend', onPointerUp); canvas.removeEventListener('touchcancel', onPointerUp); document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); root.remove(); originalDestroy(); }
      // eslint-disable-next-line no-func-assign
      destroy = cleanup;
    }
  }
})();

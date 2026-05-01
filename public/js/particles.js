/**
 * Around You — Animated particle background
 * Purple-themed connected nodes with aurora glow, inspired by voxr.ai
 */
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let w, h;
  let particles = [];
  let mouse = { x: null, y: null, radius: 140 };
  let animId;

  const CONFIG = {
    count: 60,
    speed: 0.25,
    size: { min: 0.8, max: 2 },
    linkDistance: 160,
    linkOpacity: 0.08,
    colors: [
      { r: 139, g: 92, b: 246 },  // purple
      { r: 6, g: 182, b: 212 },   // cyan
      { r: 167, g: 139, b: 250 }, // light purple
      { r: 255, g: 255, b: 255 }, // white (rare)
    ],
    colorWeights: [0.45, 0.25, 0.25, 0.05],
  };

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function pickColor() {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < CONFIG.colorWeights.length; i++) {
      acc += CONFIG.colorWeights[i];
      if (r < acc) return CONFIG.colors[i];
    }
    return CONFIG.colors[0];
  }

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * CONFIG.speed;
      this.vy = (Math.random() - 0.5) * CONFIG.speed;
      this.size = CONFIG.size.min + Math.random() * (CONFIG.size.max - CONFIG.size.min);
      this.color = pickColor();
      this.baseOpacity = 0.25 + Math.random() * 0.45;
      this.pulseSpeed = 0.003 + Math.random() * 0.007;
      this.pulseOffset = Math.random() * Math.PI * 2;
      this.currentOpacity = this.baseOpacity;
    }

    update(time) {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < -20) this.x = w + 20;
      if (this.x > w + 20) this.x = -20;
      if (this.y < -20) this.y = h + 20;
      if (this.y > h + 20) this.y = -20;

      // Mouse interaction - gentle push
      if (mouse.x !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius * 0.012;
          this.vx += dx * force;
          this.vy += dy * force;
        }
      }

      // Dampen
      this.vx *= 0.998;
      this.vy *= 0.998;

      // Pulse
      this.currentOpacity = this.baseOpacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.12;
    }

    draw() {
      const { r, g, b } = this.color;

      // Core dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.currentOpacity})`;
      ctx.fill();

      // Outer glow
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.currentOpacity * 0.06})`;
      ctx.fill();
    }
  }

  function init() {
    particles = [];
    const count = Math.min(CONFIG.count, Math.floor((w * h) / 18000));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function drawLinks() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.linkDistance) {
          const opacity = (1 - dist / CONFIG.linkDistance) * CONFIG.linkOpacity;
          // Use purple for links
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }
  }

  function animate(time) {
    ctx.clearRect(0, 0, w, h);

    particles.forEach(p => {
      p.update(time);
      p.draw();
    });

    drawLinks();
    animId = requestAnimationFrame(animate);
  }

  // Events
  window.addEventListener('resize', () => {
    resize();
    init();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Start
  resize();
  init();
  animate(0);

  // Add subtle scanline overlay
  const scanline = document.createElement('div');
  scanline.className = 'scanline-overlay';
  document.body.appendChild(scanline);
})();

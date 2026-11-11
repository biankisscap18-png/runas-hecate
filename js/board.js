// Pizarra: captura de trazos, varita y chispas.
// Los trazos se guardan normalizados (0..1) para sobrevivir a cambios de tamaño.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const penColor = () => getComputedStyle(document.documentElement).getPropertyValue('--pen').trim() || '#000';

export class Board {
  strokes = [];
  penWidth = 0.012; // grosor del trazo como fracción del ancho de la pizarra
  #current = null;
  #sparks = [];
  #raf = 0;

  constructor({ board, canvas, fx, wand }) {
    this.board = board;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = fx;
    this.fxCtx = fx.getContext('2d');
    this.wand = wand;
    this.#bind();
    new ResizeObserver(() => this.fit()).observe(this.board);
    this.fit();
  }

  fit() {
    const { width } = this.board.getBoundingClientRect();
    const size = Math.round(width * (window.devicePixelRatio || 1));
    this.canvas.width = this.canvas.height = this.fx.width = this.fx.height = size;
    this.redraw();
  }

  clear() {
    this.strokes = [];
    this.redraw();
  }

  redraw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    ctx.clearRect(0, 0, w, w);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = penColor();
    for (const s of this.strokes) {
      ctx.lineWidth = w * (s.w ?? 0.012);
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0][0] * w, s[0][1] * w, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      s.forEach((p, i) => (i ? ctx.lineTo(p[0] * w, p[1] * w) : ctx.moveTo(p[0] * w, p[1] * w)));
      ctx.stroke();
    }
  }

  #point(e) {
    const r = this.board.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  #moveWand(e) {
    const r = this.board.getBoundingClientRect();
    // La punta de la varita (esquina inferior izquierda del SVG) queda sobre el puntero.
    this.wand.style.transform = `translate(${e.clientX - r.left - 6}px, ${e.clientY - r.top - 58}px)`;
    this.wand.style.opacity = 1;
  }

  #bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.#current = [this.#point(e)];
      this.#current.w = this.penWidth;
      this.strokes.push(this.#current);
      this.#moveWand(e);
      this.redraw();
      this.#spark(this.#current[0]);
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      this.#moveWand(e);
      if (!this.#current) return;
      const p = this.#point(e);
      this.#current.push(p);
      this.redraw();
      this.#spark(p);
    });
    const end = (e) => {
      this.#current = null;
      if (e.pointerType === 'touch') this.wand.style.opacity = 0;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => { if (!this.#current) this.wand.style.opacity = 0; });
  }

  #spark([x, y]) {
    if (reducedMotion) return;
    for (let i = 0; i < 2; i++) {
      this.#sparks.push({ x, y, vx: (Math.random() - 0.5) * 0.004, vy: (Math.random() - 0.5) * 0.004 - 0.001, life: 1 });
    }
    if (!this.#raf) this.#raf = requestAnimationFrame(() => this.#tick());
  }

  #tick() {
    const { fxCtx: g, fx } = this;
    const w = fx.width;
    g.clearRect(0, 0, w, w);
    g.fillStyle = penColor();
    this.#sparks = this.#sparks.filter((s) => s.life > 0);
    for (const s of this.#sparks) {
      s.x += s.vx; s.y += s.vy; s.life -= 0.03;
      g.globalAlpha = Math.max(s.life, 0);
      g.beginPath();
      g.arc(s.x * w, s.y * w, w * 0.005 * (s.life + 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    this.#raf = this.#sparks.length ? requestAnimationFrame(() => this.#tick()) : 0;
  }
}

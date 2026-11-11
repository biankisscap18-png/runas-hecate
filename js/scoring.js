// Cálculo del % de parecido entre el dibujo y la runa original. Sin curvas de ayuda:
// el porcentaje es directamente la similitud medida, y la medida es estricta.
//
// 1. Dibujo y runa se centran por la caja de su línea central y se escalan con la misma
//    proporción a una cuadrícula GRID×GRID (da igual dónde ni de qué tamaño se dibuje).
// 2. La runa se adelgaza a su esqueleto y el dibujo se reduce a puntos equiespaciados
//    sobre tu trazo, así el grosor del lápiz no influye.
// 3. Cada punto lleva también la DIRECCIÓN de su trazo. Un punto solo acierta si está
//    cerca de la línea de la runa Y va en una dirección parecida: un garabato puede rozar
//    muchas líneas, pero casi nunca con la orientación correcta. Los puntos sueltos
//    (sin dirección) no cuentan como acierto ni cubren nada.
// 4. Precisión (tu dibujo → runa) y cobertura (runa → tu dibujo) usan una cercanía que
//    vale 1 hasta FLAT celdas y baja hasta 0 en TOL celdas. El resultado es su producto:
//    sobrar trazo y faltar trazo penalizan por igual. Si dibujas mucha más tinta que la
//    runa (MAX_INK), la nota baja además en proporción.
// 5. Se prueba un pequeño margen de alineamiento (desplazamiento y escala) y se toma el
//    mejor, porque la caja envolvente es un ancla frágil. Eso no ayuda a un garabato.
export const GRID = 128;
export const PAD = 10;
export const FLAT = 2;           // hasta esta distancia (celdas) el punto cuenta entero
export const TOL = 8;            // distancia (celdas) a la que un punto deja de contar
export const ANGLE_W = 4;        // celdas de "coste" por cada radián de diferencia de dirección
export const POWER = 1.5;        // 1 = caída lineal, 2 = cuadrática (más estricto)
export const MIN_EXTENT = 0.12;  // tamaño mínimo del dibujo (fracción de la pizarra)
export const MAX_INK = 1.8;      // tinta máxima respecto a la de la runa antes de penalizar
const BINS = 12;                 // orientaciones cuantizadas (cada 15°)
const INF = 1e9;

/* ---------- rasterizado (solo navegador) ---------- */

function rasterizeImage(img, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rs = (size - 2 * PAD) / Math.max(img.naturalWidth, img.naturalHeight);
  g.drawImage(
    img,
    (size - img.naturalWidth * rs) / 2, (size - img.naturalHeight * rs) / 2,
    img.naturalWidth * rs, img.naturalHeight * rs,
  );
  const data = g.getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  return mask;
}

/* ---------- adelgazado (Zhang-Suen) ---------- */

function thin(mask, W) {
  const m = Uint8Array.from(mask);
  const H = m.length / W;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const del = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!m[y * W + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) A++;
          if (A !== 1) continue;
          if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          del.push(y * W + x);
        }
      }
      if (del.length) changed = true;
      for (const i of del) m[i] = 0;
    }
  }
  return m;
}

/* ---------- distancias orientadas ---------- */

// Distancia (en celdas) de cada celda al píxel activo más cercano (chamfer de dos pasadas).
function distanceMap(mask) {
  const G = GRID, S = Math.SQRT2, d = new Float32Array(G * G);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const i = y * G + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - G] + 1);
        if (x > 0) v = Math.min(v, d[i - G - 1] + S);
        if (x < G - 1) v = Math.min(v, d[i - G + 1] + S);
      }
      d[i] = v;
    }
  }
  for (let y = G - 1; y >= 0; y--) {
    for (let x = G - 1; x >= 0; x--) {
      const i = y * G + x;
      let v = d[i];
      if (x < G - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < G - 1) {
        v = Math.min(v, d[i + G] + 1);
        if (x < G - 1) v = Math.min(v, d[i + G + 1] + S);
        if (x > 0) v = Math.min(v, d[i + G - 1] + S);
      }
      d[i] = v;
    }
  }
  return d;
}

const binOf = (a) => {                       // ángulo (mod π) → índice de orientación
  let t = a % Math.PI;
  if (t < 0) t += Math.PI;
  return Math.round(t / (Math.PI / BINS)) % BINS;
};
const binDiff = (a, b) => {                  // diferencia angular entre bins, en radianes (0..π/2)
  const k = Math.abs(a - b);
  return Math.min(k, BINS - k) * (Math.PI / BINS);
};

// Un "campo orientado": para cada orientación, el mapa de distancias a los puntos con esa dirección.
// Los puntos sin dirección (ori < 0, p. ej. toques sueltos) no cubren nada: una lluvia de
// puntitos no puede hacerse pasar por una línea.
function orientedField(points) {
  const masks = Array.from({ length: BINS }, () => new Uint8Array(GRID * GRID));
  for (const p of points) {
    if (p.ori < 0) continue;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    masks[p.ori][y * GRID + x] = 1;
  }
  return masks.map(distanceMap);
}

// Distancia orientada de un punto al campo: distancia + coste angular, mínimo entre orientaciones.
function orientedDistance(field, p) {
  const x = Math.min(GRID - 1, Math.max(0, Math.round(p.x)));
  const y = Math.min(GRID - 1, Math.max(0, Math.round(p.y)));
  const i = y * GRID + x;
  if (p.ori < 0) return INF;                 // sin dirección: nunca acierta
  let best = INF;
  for (let b = 0; b < BINS; b++) {
    const d = field[b][i] + ANGLE_W * binDiff(p.ori, b);
    if (d < best) best = d;
  }
  return best;
}

const closeness = (d) => (d <= FLAT ? 1 : d >= TOL ? 0 : Math.pow(1 - (d - FLAT) / (TOL - FLAT), POWER));

function meanCloseness(points, field) {
  if (!points.length) return 0;
  let sum = 0;
  for (const p of points) sum += closeness(orientedDistance(field, p));
  return sum / points.length;
}

/* ---------- puntos de la runa (esqueleto + dirección) ---------- */

function refPoints(skel) {
  const pts = [];
  const R = 3;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!skel[y * GRID + x]) continue;
      // Dirección local: eje principal de los píxeles del esqueleto en un entorno de radio R.
      let n = 0, mx = 0, my = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= GRID || yy >= GRID || !skel[yy * GRID + xx]) continue;
        n++; mx += xx; my += yy;
      }
      mx /= n; my /= n;
      let sxx = 0, syy = 0, sxy = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= GRID || yy >= GRID || !skel[yy * GRID + xx]) continue;
        sxx += (xx - mx) ** 2; syy += (yy - my) ** 2; sxy += (xx - mx) * (yy - my);
      }
      const ori = n < 3 ? -1 : binOf(0.5 * Math.atan2(2 * sxy, sxx - syy));
      pts.push({ x, y, ori });
    }
  }
  return pts;
}

/* ---------- puntos del dibujo (equiespaciados + dirección) ---------- */

function userPoints(strokes, x0, y0, s, ox, oy) {
  const f = ([x, y]) => ({ x: (x - x0) * s + ox, y: (y - y0) * s + oy });
  const out = [];
  let length = 0;
  for (const st of strokes) {
    const q = st.map(f);
    if (q.length === 1) { out.push({ x: q[0].x, y: q[0].y, ori: -1 }); continue; }
    // 1) remuestreo a paso fijo de 1 celda
    const res = [q[0]];
    let carry = 0;
    for (let i = 1; i < q.length; i++) {
      let ax = q[i - 1].x, ay = q[i - 1].y;
      const bx = q[i].x, by = q[i].y;
      let seg = Math.hypot(bx - ax, by - ay);
      while (carry + seg >= 1) {
        const t = (1 - carry) / seg;
        ax += (bx - ax) * t; ay += (by - ay) * t;
        res.push({ x: ax, y: ay });
        seg = Math.hypot(bx - ax, by - ay);
        carry = 0;
      }
      carry += seg;
    }
    if (res.length < 2) { out.push({ x: res[0].x, y: res[0].y, ori: -1 }); continue; }
    length += res.length;
    // 2) dirección con una ventana de ±3 muestras (suaviza el temblor de la mano)
    const K = 3;
    for (let i = 0; i < res.length; i++) {
      const a = res[Math.max(0, i - K)], b = res[Math.min(res.length - 1, i + K)];
      out.push({ x: res[i].x, y: res[i].y, ori: binOf(Math.atan2(b.y - a.y, b.x - a.x)) });
    }
  }
  return { pts: out, length };
}

/* ---------- puntuación ---------- */

// Prepara una runa: esqueleto, direcciones y campo orientado. Se calcula una vez por runa.
export function prepareRef(mask) {
  const raw = refPoints(thin(mask, GRID));
  // Igual que el dibujo, la runa se normaliza por la caja de su LÍNEA CENTRAL (no por el
  // borde del trazo grueso), para que ambos se comparen en la misma escala.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of raw) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const w = x1 - x0, h = y1 - y0;
  const s = (GRID - 2 * PAD) / Math.max(w, h, 1);
  const ox = (GRID - w * s) / 2, oy = (GRID - h * s) / 2;
  const pts = raw.map((p) => ({ x: (p.x - x0) * s + ox, y: (p.y - y0) * s + oy, ori: p.ori }));
  return { pts, field: orientedField(pts) };
}

// Alineamientos que se prueban tras normalizar por la caja envolvente. La caja es un ancla
// frágil (basta un extremo algo corto o largo para desplazar todo), así que se busca el
// mejor ajuste dentro de un margen pequeño. Un garabato no gana nada con esto: su problema
// es la forma, no la posición.
const SHIFTS = [-3, -1.5, 0, 1.5, 3];
const SCALES = [0.96, 1, 1.04];
const C0 = GRID / 2;

/**
 * Núcleo puro (sin DOM): `ref` viene de prepareRef().
 * @returns {{pct:number, precision:number, coverage:number, ink:number}|{error:'empty'|'small'}}
 */
export function scoreStrokes(strokes, ref) {
  const flat = strokes.flat();
  if (!flat.length) return { error: 'empty' };

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of flat) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0, h = y1 - y0;
  if (Math.max(w, h) < MIN_EXTENT) return { error: 'small' };

  const s = (GRID - 2 * PAD) / Math.max(w, h);
  const { pts: user, length } = userPoints(strokes, x0, y0, s, (GRID - w * s) / 2, (GRID - h * s) / 2);
  const userField = orientedField(user);

  // Para cada alineamiento T: precisión con el dibujo movido por T sobre el campo de la runa,
  // y cobertura con la runa movida por T⁻¹ sobre el campo del dibujo (así el campo del dibujo
  // se calcula una sola vez).
  let best = { score: -1, precision: 0, coverage: 0 };
  for (const sc of SCALES) for (const dx of SHIFTS) for (const dy of SHIFTS) {
    const moved = user.map((p) => ({ x: C0 + sc * (p.x - C0) + dx, y: C0 + sc * (p.y - C0) + dy, ori: p.ori }));
    const back = ref.pts.map((p) => ({ x: C0 + (p.x - C0 - dx) / sc, y: C0 + (p.y - C0 - dy) / sc, ori: p.ori }));
    const precision = meanCloseness(moved, ref.field);
    const coverage = meanCloseness(back, userField);
    const score = precision * coverage;
    if (score > best.score) best = { score, precision, coverage };
  }

  // Tinta de más: si dibujas mucho más trazo que la runa, la nota baja en proporción.
  const ink = ref.pts.length ? length / ref.pts.length : 0;
  const inkFactor = ink > MAX_INK ? MAX_INK / ink : 1;

  return {
    pct: Math.round(100 * best.score * inkFactor),
    precision: best.precision, coverage: best.coverage, ink,
  };
}

/* ---------- envoltorio para el navegador ---------- */

const cache = new WeakMap();

/** @returns {{pct:number}|{error:'empty'|'small'}} */
export function scoreDrawing(strokes, refImage) {
  let ref = cache.get(refImage);
  if (!ref) { ref = prepareRef(rasterizeImage(refImage, GRID)); cache.set(refImage, ref); }
  return scoreStrokes(strokes, ref);
}

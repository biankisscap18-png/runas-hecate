import { RUNES } from './runes.js';
import { Board } from './board.js';
import { scoreDrawing } from './scoring.js';
import { loadBest, saveBest } from './storage.js';

const $ = (s) => document.querySelector(s);
// Ruta absoluta: una URL relativa dentro de una variable CSS se resuelve respecto
// a la hoja de estilos (css/), no a index.html, y la imagen no se encontraría.
const url = (r) => `url('${new URL(r.file, document.baseURI).href}')`;

RUNES.forEach((r) => { r.img = new Image(); r.img.src = r.file; });

const board = new Board({ board: $('#board'), canvas: $('#draw'), fx: $('#fx'), wand: $('#wand') });
const best = loadBest();
let current = 0;

// Muestra la runa sobre la pizarra durante 5 segundos y luego la oculta.
const peekBtn = $('#btn-peek');
const peekEl = $('#peek');
const PEEK_SECONDS = 5;
let peekTimer = 0;

function stopPeek() {
  clearInterval(peekTimer);
  peekTimer = 0;
  peekEl.classList.remove('on');
  peekBtn.disabled = false;
  peekBtn.textContent = `Ver ${PEEK_SECONDS} s`;
}

function startPeek() {
  stopPeek();
  let left = PEEK_SECONDS;
  peekEl.classList.add('on');
  peekBtn.disabled = true;
  peekBtn.textContent = `${left} s`;
  peekTimer = setInterval(() => {
    left--;
    if (left <= 0) stopPeek();
    else peekBtn.textContent = `${left} s`;
  }, 1000);
}

function messageFor(pct) {
  if (pct >= 90) return 'La runa responde a tu varita. ¡Casi idéntica!';
  if (pct >= 70) return 'Muy cerca: se nota la forma de la runa.';
  if (pct >= 40) return 'Hay parecido, pero faltan trazos o proporciones.';
  return 'Todavía no se parece. Mira la runa e inténtalo de nuevo.';
}

function showResult(pct, msg) {
  $('#pct').textContent = pct === null ? '—' : `${pct}%`;
  $('#msg').textContent = msg;
}

function renderBest() {
  $('#best').textContent = best[current] ? `Mejor: ${best[current]}%` : '';
}

function renderGrid() {
  const grid = $('#rune-grid');
  grid.innerHTML = '';
  RUNES.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'r';
    b.setAttribute('aria-current', String(i === current));
    b.innerHTML = `<i style="--m:${url(r)}"></i><span>${r.name}</span>`;
    b.addEventListener('click', () => { select(i); $('#picker').close(); });
    grid.appendChild(b);
  });
}

function select(i) {
  current = i;
  const r = RUNES[i];
  board.clear();
  $('#rune-title').textContent = r.title;
  $('#model-icon').style.setProperty('--m', url(r));
  $('#pick-icon').style.setProperty('--m', url(r));
  $('#big-icon').style.setProperty('--m', url(r));
  peekEl.style.setProperty('--m', url(r));
  stopPeek();
  $('#big-name').textContent = r.title;
  showResult(null, 'Dibuja la runa y pulsa Evaluar.');
  renderBest();
  renderGrid();
}

async function evaluate() {
  const r = RUNES[current];
  await r.img.decode().catch(() => {});
  const res = scoreDrawing(board.strokes, r.img);
  if (res.error === 'empty') return showResult(null, 'Aún no hay nada en la pizarra. Dibuja la runa primero.');
  if (res.error === 'small') return showResult(null, 'El trazo es muy pequeño. Dibuja la runa más grande.');
  showResult(res.pct, messageFor(res.pct));
  if (res.pct > (best[current] || 0)) { best[current] = res.pct; saveBest(best); renderBest(); }
}

$('#btn-eval').addEventListener('click', evaluate);
$('#btn-clear').addEventListener('click', () => { board.clear(); showResult(null, 'Pizarra limpia. Dibuja de nuevo.'); });
document.querySelectorAll('.pens button[data-w]').forEach((b) => b.addEventListener('click', () => {
  board.penWidth = Number(b.dataset.w);
  document.querySelectorAll('.pens button[data-w]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
$('#btn-peek').addEventListener('click', startPeek);
$('#open-picker').addEventListener('click', () => {
  stopPeek();
  $('#picker').showModal();
  $('#rune-grid .r[aria-current="true"]')?.scrollIntoView({ block: 'center' });
});
$('#picker-close').addEventListener('click', () => $('#picker').close());
$('#picker').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#view-rune').addEventListener('click', () => $('#viewer').showModal());
$('#viewer-close').addEventListener('click', () => $('#viewer').close());
$('#viewer').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

select(0);

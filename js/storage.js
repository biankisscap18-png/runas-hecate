const KEY = 'runas-best';

export function loadBest() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function saveBest(best) {
  try { localStorage.setItem(KEY, JSON.stringify(best)); } catch { /* almacenamiento no disponible */ }
}

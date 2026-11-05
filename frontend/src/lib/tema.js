// Modo claro u oscuro. El script en línea de index.html aplica el tema antes de pintar,
// para evitar un destello; aquí se mantiene sincronizado y se guarda la elección.
import { useSyncExternalStore } from 'react';

const CLAVE = 'tema-dashboard';
const COLOR_BARRA = { claro: '#FAFAFA', oscuro: '#0B1220' };
const oyentes = new Set();

// El almacenamiento puede estar bloqueado: entonces el tema dura solo esta visita.
function leerGuardado() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'claro' || t === 'oscuro' ? t : null;
  } catch {
    return null;
  }
}

function guardar(tema) {
  try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
}

const sistema = () => window.matchMedia('(prefers-color-scheme: dark)');
const temaActual = () => document.documentElement.dataset.tema || 'claro';

function aplicar(tema) {
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema]);
  oyentes.forEach((avisar) => avisar());
}

export function alternarTema() {
  const siguiente = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
  guardar(siguiente);
  aplicar(siguiente);
}

aplicar(leerGuardado() ?? (sistema().matches ? 'oscuro' : 'claro'));
// Mientras la persona no elija, el tablero sigue al sistema.
sistema().addEventListener('change', (e) => {
  if (!leerGuardado()) aplicar(e.matches ? 'oscuro' : 'claro');
});

const suscribir = (avisar) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};

export const useTema = () => useSyncExternalStore(suscribir, temaActual);

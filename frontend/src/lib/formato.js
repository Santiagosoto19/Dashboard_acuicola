// Formato de fechas (español, America/Bogota) y números.
export const ZONA = 'America/Bogota';
// Colombia no tiene horario de verano. ECharts dibuja en UTC y los tiempos se
// desplazan -5 h, así el eje muestra hora de Bogotá en cualquier navegador.
export const DESFASE_MS = -5 * 3600 * 1000;
export const aEje = (ts) => ts + DESFASE_MS;

const fmtFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const fmtFechaCorta = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

export const fechaHora = (ts) => (ts == null ? '—' : fmtFechaHora.format(new Date(ts)));
export const fechaCorta = (ts) => (ts == null ? '—' : fmtFechaCorta.format(new Date(ts)));
export const hora = (ts) => (ts == null ? '—' : fmtHora.format(new Date(ts)));
export const fechaDeEje = (tsEje) => fechaHora(tsEje - DESFASE_MS);

export function hace(ts, ahora = Date.now()) {
  if (ts == null) return '';
  const seg = Math.max(0, Math.round((ahora - ts) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h`;
  const dias = Math.round(seg / 86400);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export function duracion(ms) {
  const seg = Math.round(ms / 1000);
  if (seg < 60) return `${seg} s`;
  if (seg < 3600) return `${Math.floor(seg / 60)} min ${seg % 60} s`;
  return `${Math.floor(seg / 3600)} h ${Math.round((seg % 3600) / 60)} min`;
}

export function conUnidad(variable, valor) {
  if (valor === null || valor === undefined) return '—';
  const n = Number(valor).toFixed(variable?.decimales ?? 1);
  return variable?.unidad ? `${n} ${variable.unidad}` : n;
}

export function textoLimite(variable) {
  const { min, max } = variable.limite;
  const u = variable.unidad ? ` ${variable.unidad}` : '';
  if (min !== undefined && max !== undefined) return `${min}–${max}${u}`;
  if (max !== undefined) return `máx. ${max}${u}`;
  if (min !== undefined) return `mín. ${min}${u}`;
  return 'sin límite';
}

export function textoVariacion(lectura, decimales) {
  if (lectura?.variacion === null || lectura?.variacion === undefined) return null;
  const v = lectura.variacion;
  const redondeado = Number(v.toFixed(decimales));
  const signo = redondeado > 0 ? '+' : '';
  const pct = lectura.variacionPct !== null && lectura.variacionPct !== undefined
    ? ` (${v > 0 ? '+' : ''}${lectura.variacionPct}%)` : '';
  return `${signo}${redondeado}${pct}`;
}

// Convierte el valor de un input datetime-local a ms, leyéndolo como hora de Bogotá.
export const bogotaAMs = (texto) => Date.parse(`${texto}:00-05:00`);
export const msABogota = (ts) => new Date(ts + DESFASE_MS).toISOString().slice(0, 16);

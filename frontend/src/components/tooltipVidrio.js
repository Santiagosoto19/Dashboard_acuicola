// Contenido del tooltip en vidrio. ECharts pide HTML en texto, así que todo valor
// dinámico pasa por esc() antes de insertarse.
import { conUnidad, fechaDeEje } from '../lib/formato';
import { distanciaAlLimite, ESTADO_VARIABLE, estadoDeValor } from '../lib/severidad';

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Solo anima al aparecer, no cada vez que el cursor cambia de punto.
let ultimaLlamada = 0;
function claseEntrada() {
  const ahora = Date.now();
  const entra = ahora - ultimaLlamada > 400;
  ultimaLlamada = ahora;
  return entra ? 'tt tt--entra' : 'tt';
}

// Punto anterior con valor en la serie, para calcular el cambio.
function previoDe(puntos, indice) {
  for (let i = indice - 1; i >= 0; i -= 1) if (puntos[i][1] !== null) return puntos[i][1];
  return null;
}

export function filaVariable({ variable, valor, previo, nodo, color, margen }) {
  const estado = ESTADO_VARIABLE[estadoDeValor(variable, valor, margen)];
  const icono = { critica: '●', advertencia: '▲', normal: '✓', sin_dato: '–' }[estado.tono];
  let cambio = '';
  if (previo !== null && previo !== undefined) {
    const d = valor - previo;
    const signo = d > 0 ? '+' : '';
    const pct = previo !== 0 ? ` (${signo}${((d / Math.abs(previo)) * 100).toFixed(1)}%)` : '';
    cambio = `<div>Cambio: <span class="num">${signo}${Number(d.toFixed(variable.decimales))}${pct}</span></div>`;
  }
  return `<div class="tt__fila">
    <div><span class="tt__marca" style="background:${color}"></span>Nodo ${esc(nodo)}</div>
    <div class="tt__valor">${esc(conUnidad(variable, valor))}</div>
    ${cambio}
    <div><b>${icono} ${esc(estado.etiqueta)}</b></div>
    <div style="color:var(--color-tinta-2)">${esc(distanciaAlLimite(variable, valor))}</div>
  </div>`;
}

export function tooltipSerie({ variable, series, margen, colorDe, fechaDe = fechaDeEje }) {
  return (params) => {
    const lista = (Array.isArray(params) ? params : [params]).filter((p) => String(p.seriesId).startsWith('nodo-') && p.value?.[1] !== null && p.value?.[1] !== undefined);
    if (!lista.length) return '';
    const filas = lista.map((p) => {
      const nodo = String(p.seriesId).replace('nodo-', '');
      return filaVariable({ variable, valor: p.value[1], previo: previoDe(series[nodo] ?? [], p.dataIndex), nodo, color: colorDe(nodo), margen });
    }).join('');
    return `<div class="${claseEntrada()}"><div class="tt__hora num">${esc(fechaDe(lista[0].value[0]))}</div>${filas}</div>`;
  };
}

export function tooltipSimple(html) {
  return `<div class="${claseEntrada()}">${html}</div>`;
}

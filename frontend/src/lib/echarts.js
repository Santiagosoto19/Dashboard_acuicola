// ECharts con solo los módulos que se usan, para reducir el peso de la compilación.
import * as echarts from 'echarts/core';
import {
  BarChart, CustomChart, EffectScatterChart, HeatmapChart, LineChart, PieChart, ScatterChart,
} from 'echarts/charts';
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import langES from 'echarts/lib/i18n/langES.js';
import { C } from './colores';
import { aEje } from './formato';

echarts.use([
  BarChart, CustomChart, EffectScatterChart, HeatmapChart, LineChart, PieChart, ScatterChart,
  DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  TitleComponent, TooltipComponent, VisualMapComponent, LabelLayout, UniversalTransition, CanvasRenderer,
]);
echarts.registerLocale('ES', langES.default ?? langES);

export { echarts };

// Vidrio del tooltip: fondo y desenfoque viven en el contenedor de ECharts.
export const TOOLTIP_VIDRIO = {
  backgroundColor: 'var(--tooltip-fondo)',
  borderWidth: 1,
  borderColor: 'var(--color-borde-2)',
  padding: [10, 12],
  textStyle: { color: C.tinta, fontSize: 12 },
  confine: true,
  transitionDuration: 0.12,
  extraCssText: 'backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);border-radius:12px;box-shadow:0 12px 28px -8px rgba(15,23,42,.22);',
};

export const EJE_VALOR = {
  type: 'value',
  axisLabel: { color: C.tinta3, hideOverlap: true, fontSize: 11 },
  splitLine: { lineStyle: { color: C.linea, width: 1 } },
  axisLine: { show: false },
};

// El eje se ajusta a los datos del rango: si solo hay 25 min en 24 h se ven esos
// 25 min, con sus horas reales. Todas las gráficas comparten esta ventana.
// Con un eje comprimido, los días sin datos no ocupan espacio y la etiqueta es la fecha real.
export function ejeTiempo(lecturas, comprimido) {
  const convertir = comprimido?.aEje ?? aEje;
  const inicio = convertir(lecturas.primerDato ?? lecturas.desde);
  const fin = convertir(lecturas.ultimoDato ?? lecturas.hasta);
  const margen = Math.max((fin - inicio) * 0.02, 30 * 1000);
  return {
    type: 'time',
    min: inicio - margen,
    max: fin + margen,
    // null explícito: setOption combina ejes y, si no, conservaría el formato anterior.
    axisLabel: { color: C.tinta3, hideOverlap: true, fontSize: 11, formatter: comprimido?.etiqueta ?? null },
    axisLine: { lineStyle: { color: C.eje } },
    splitLine: { show: false },
  };
}

// Franjas grises donde el eje comprimido se saltó un periodo sin datos.
export function franjasDeHuecos(comprimido) {
  return comprimido.huecos.map((h) => [
    {
      name: h.texto,
      xAxis: comprimido.aEje(h.desde),
      itemStyle: { color: 'rgba(100,116,139,0.16)' },
      label: { color: C.tinta2, fontSize: 10, position: 'insideTop' },
    },
    { xAxis: comprimido.aEje(h.hasta) },
  ]);
}

export function zoomTiempo(extra = {}) {
  return [
    { type: 'inside', filterMode: 'none', ...extra },
    {
      type: 'slider', height: 18, bottom: 6, filterMode: 'none', borderColor: 'transparent',
      backgroundColor: 'var(--grafica-sombra)', fillerColor: 'rgba(59,130,246,0.14)',
      handleStyle: { color: '#3B82F6', borderColor: '#3B82F6' }, moveHandleSize: 0,
      showDetail: false, showDataShadow: false, brushSelect: true,
      brushStyle: { color: 'rgba(59,130,246,0.14)' }, ...extra,
    },
  ];
}

// El eje incluye los dos umbrales aunque los datos no los alcancen o los superen.
// Mínimo, máximo e intervalo se calculan juntos para que las marcas sean redondas.
export function escalaY(limite, puntos) {
  const valores = puntos.map((p) => p[1]).filter((v) => v !== null);
  const todos = [...valores, ...[limite.min, limite.max].filter((x) => x !== undefined)];
  if (!todos.length) return {};
  const bajo = todos.reduce((a, b) => Math.min(a, b));
  const alto = todos.reduce((a, b) => Math.max(a, b));
  const tramo = alto - bajo || 1;
  const magnitud = 10 ** Math.floor(Math.log10(tramo / 5));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((x) => tramo / x <= 6) ?? 10 * magnitud;
  const redondear = (x) => Number(x.toFixed(4));
  const minimo = Math.floor((bajo - tramo * 0.03) / paso) * paso;
  return {
    min: redondear(bajo >= 0 ? Math.max(0, minimo) : minimo),
    max: redondear(Math.ceil((alto + tramo * 0.03) / paso) * paso),
    interval: redondear(paso),
  };
}

// Patrón rayado de "sin datos" para los lienzos de ECharts.
// Se crea una vez por tema, porque renderItem lo pide en cada segmento.
const rayados = new Map();
export function patronRayado() {
  if (typeof document === 'undefined') return C.sin_dato;
  const estilos = getComputedStyle(document.documentElement);
  const fondo = estilos.getPropertyValue('--rayado-a').trim();
  const raya = estilos.getPropertyValue('--rayado-b').trim();
  const clave = `${fondo}|${raya}`;
  if (rayados.has(clave)) return rayados.get(clave);
  const lienzo = document.createElement('canvas');
  lienzo.width = 10;
  lienzo.height = 10;
  const c = lienzo.getContext('2d');
  c.fillStyle = fondo;
  c.fillRect(0, 0, 10, 10);
  c.strokeStyle = raya;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-2, 8); c.lineTo(8, -2);
  c.moveTo(2, 12); c.lineTo(12, 2);
  c.stroke();
  const patron = { image: lienzo, repeat: 'repeat' };
  rayados.set(clave, patron);
  return patron;
}

// Gráfica de una variable: área, líneas, barras o dispersión, con morphing entre tipos.
// Banda verde en la zona permitida y puntos rojos que pulsan al salirse de ella.
import { useMemo } from 'react';
import { useReducedMotion } from 'motion/react';
import Lienzo from './Lienzo';
import { C, colorNodo } from '../lib/colores';
import { crearEjeComprimido } from '../lib/ejeComprimido';
import { echarts, EJE_VALOR, ejeTiempo, escalaY, franjasDeHuecos, TOOLTIP_VIDRIO, zoomTiempo } from '../lib/echarts';
import { tooltipSerie } from './tooltipVidrio';

export const TIPOS_GRAFICA = [
  { valor: 'area', etiqueta: 'Área' },
  { valor: 'lineas', etiqueta: 'Líneas' },
  { valor: 'barras', etiqueta: 'Barras' },
  { valor: 'dispersion', etiqueta: 'Dispersión' },
];

const MAX_PULSOS = 3;
const fuera = (l, v) => v !== null && ((l.min !== undefined && v < l.min) || (l.max !== undefined && v > l.max));

function serieDe(tipo, nodo, puntos, aEje) {
  const color = colorNodo(nodo);
  const datos = puntos.map(([ts, v]) => [aEje(ts), v]);
  const base = { id: `nodo-${nodo}`, name: `Nodo ${nodo}`, data: datos, universalTransition: true, itemStyle: { color } };
  if (tipo === 'barras') return { ...base, type: 'bar', barMinWidth: 3, barMaxWidth: 10, itemStyle: { color, borderRadius: [3, 3, 0, 0] } };
  if (tipo === 'dispersion') return { ...base, type: 'scatter', symbolSize: 7 };
  return {
    ...base,
    type: 'line',
    smooth: tipo === 'area' ? 0.35 : false,
    symbol: 'circle',
    symbolSize: 5,
    showSymbol: puntos.length < 90,
    connectNulls: false,
    lineStyle: { width: 2, color },
    areaStyle: tipo === 'area' ? {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: `${color}40` }, { offset: 1, color: `${color}05` },
      ]),
    } : undefined,
  };
}

export default function GraficaVariable({ variable, series = {}, lecturas, tipo, grupo, margen, alto = 'h-72', zoom = true }) {
  const reducido = useReducedMotion();
  const nodos = Object.keys(series).sort((a, b) => a - b);
  const vacio = nodos.length === 0 || !lecturas;

  const opcion = useMemo(() => {
    if (vacio) return null;
    const limite = variable.limite;
    const comprimido = crearEjeComprimido(lecturas);
    const { aEje } = comprimido;
    const todos = nodos.flatMap((n) => series[n]);
    const escala = escalaY(limite, todos);

    // Banda de la zona permitida. Con un solo límite, llega hasta el borde del eje.
    const banda = [[
      { yAxis: limite.min ?? escala.min, itemStyle: { color: 'rgba(22,163,74,0.08)' } },
      { yAxis: limite.max ?? escala.max },
    ]];
    const umbrales = [limite.min, limite.max].filter((x) => x !== undefined).map((x) => ({
      yAxis: x, label: { formatter: `${x === limite.min && limite.min !== limite.max ? 'mín' : 'máx'} ${x}` },
    }));

    const principales = nodos.map((n, i) => ({
      ...serieDe(tipo, n, series[n], aEje),
      ...(i === 0 ? {
        markArea: { silent: true, data: [...banda, ...franjasDeHuecos(comprimido)] },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: C.normal, type: 'dashed', width: 1 },
          label: { color: C.tinta2, position: 'insideStartTop', fontSize: 11 },
          data: umbrales,
        },
      } : {}),
    }));

    // Puntos fuera de límites: todos en rojo; solo los más recientes pulsan.
    const fueraDeLimite = todos.filter((p) => fuera(limite, p[1])).sort((a, b) => a[0] - b[0]);
    const marcas = [
      {
        id: 'fuera', name: 'Fuera de límites', type: 'scatter', z: 5, silent: true, symbolSize: 6,
        itemStyle: { color: C.critica, borderColor: C.superficie, borderWidth: 1 },
        data: fueraDeLimite.slice(-300).map(([ts, v]) => [aEje(ts), v]),
      },
      {
        id: 'pulso', name: 'Pulso', type: reducido ? 'scatter' : 'effectScatter', z: 6, silent: true, symbolSize: 7,
        rippleEffect: { scale: 3, brushType: 'stroke', period: 2.6 },
        itemStyle: { color: C.critica },
        data: fueraDeLimite.slice(-MAX_PULSOS).map(([ts, v]) => [aEje(ts), v]),
      },
    ];

    return {
      // Con huecos las etiquetas llevan fecha y hora: la última necesita más margen.
      grid: { left: 8, right: comprimido.huecos.length ? 40 : 16, top: 34, bottom: zoom ? 42 : 8, containLabel: true },
      legend: {
        top: 0, right: 0, itemWidth: 14, itemHeight: 8, selectedMode: true,
        textStyle: { color: C.tinta2 }, data: nodos.map((n) => `Nodo ${n}`),
      },
      xAxis: ejeTiempo(lecturas, comprimido),
      yAxis: { ...EJE_VALOR, ...escala },
      dataZoom: zoom ? zoomTiempo() : [],
      tooltip: {
        ...TOOLTIP_VIDRIO,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: C.tinta3, width: 1 } },
        formatter: tooltipSerie({ variable, series, margen, colorDe: colorNodo, fechaDe: comprimido.fechaDe }),
      },
      series: [...principales, ...marcas],
    };
  }, [variable, series, lecturas, tipo, margen, zoom, reducido, vacio, nodos.join()]); // eslint-disable-line

  return (
    <Lienzo
      opcion={opcion}
      vacio={vacio}
      grupo={grupo}
      alto={alto}
      mensaje={`Sin lecturas de ${variable.etiqueta} en este rango`}
      etiqueta={`Serie temporal de ${variable.etiqueta} por nodo`}
    />
  );
}

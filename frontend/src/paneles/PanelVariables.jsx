// Variables: una gráfica por variable con tipo, zoom y cursor sincronizados,
// más la comparativa entre nodos.
import { useMemo, useState } from 'react';
import GraficaVariable, { TIPOS_GRAFICA } from '../components/GraficaVariable';
import { PillToggle, SelectorVariable, Tarjeta } from '../components/Comunes';
import Lienzo from '../components/Lienzo';
import { C, colorNodo } from '../lib/colores';
import { conUnidad, textoLimite } from '../lib/formato';
import { crearEjeComprimido } from '../lib/ejeComprimido';
import { EJE_VALOR, ejeTiempo, escalaY, franjasDeHuecos, TOOLTIP_VIDRIO, zoomTiempo } from '../lib/echarts';
import { tooltipSimple } from '../components/tooltipVidrio';

function Comparativa({ estado, lecturas, filtroNodo }) {
  const variables = estado.variables;
  const conDatos = (nodo) => variables.find((v) => lecturas?.series[v.clave]?.[nodo]?.length)?.clave ?? variables[0].clave;
  const [elegidoA, setA] = useState(null);
  const [elegidoB, setB] = useState(null);
  const a = elegidoA ?? conDatos(1);
  const b = elegidoB ?? conDatos(2);
  const paneles = [{ nodo: 1, clave: a }, { nodo: 2, clave: b }];
  const vacio = !lecturas || !paneles.some((p) => lecturas.series[p.clave]?.[p.nodo]?.length);

  const opcion = useMemo(() => {
    if (vacio) return null;
    const v = (clave) => variables.find((x) => x.clave === clave);
    const comprimido = crearEjeComprimido(lecturas);
    const eje = (i) => ({ ...ejeTiempo(lecturas, comprimido), gridIndex: i, axisLabel: { ...ejeTiempo(lecturas, comprimido).axisLabel, show: i === 1 } });
    return {
      grid: [
        { left: 8, right: 16, top: 28, height: '34%', containLabel: true },
        { left: 8, right: 16, top: '53%', height: '31%', containLabel: true },
      ],
      title: paneles.map((p, i) => ({
        text: `Nodo ${p.nodo}: ${v(p.clave).etiqueta}${v(p.clave).unidad ? ` (${v(p.clave).unidad})` : ''}`,
        top: i === 0 ? 0 : '46%', left: 8, textStyle: { color: C.tinta2, fontSize: 12, fontWeight: 600 },
      })),
      xAxis: [eje(0), eje(1)],
      yAxis: paneles.map((p, i) => ({ ...EJE_VALOR, gridIndex: i, ...escalaY(v(p.clave).limite, lecturas.series[p.clave]?.[p.nodo] ?? []) })),
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: zoomTiempo({ xAxisIndex: [0, 1] }),
      tooltip: {
        ...TOOLTIP_VIDRIO,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: C.tinta3 } },
        formatter: (params) => {
          const filas = params.filter((p) => p.value[1] !== null).map((p) => {
            const pv = v(paneles[p.seriesIndex].clave);
            return `<div>${p.seriesName}, ${pv.etiqueta}: <b class="num">${conUnidad(pv, p.value[1])}</b></div>`;
          });
          return filas.length ? tooltipSimple(`<div class="tt__hora num">${comprimido.fechaDe(params[0].value[0])}</div>${filas.join('')}`) : '';
        },
      },
      series: paneles.map((p, i) => ({
        id: `comparar-${i}`,
        name: `Nodo ${p.nodo}`,
        type: 'line',
        xAxisIndex: i,
        yAxisIndex: i,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: colorNodo(p.nodo) },
        itemStyle: { color: colorNodo(p.nodo) },
        connectNulls: false,
        data: (lecturas.series[p.clave]?.[p.nodo] ?? []).map(([ts, x]) => [comprimido.aEje(ts), x]),
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(22,163,74,0.08)' },
          data: [
            [{ yAxis: v(p.clave).limite.min ?? 0 }, { yAxis: v(p.clave).limite.max ?? escalaY(v(p.clave).limite, lecturas.series[p.clave]?.[p.nodo] ?? []).max }],
            ...franjasDeHuecos(comprimido),
          ],
        },
      })),
    };
  }, [lecturas, a, b, vacio]); // eslint-disable-line

  return (
    <Tarjeta
      titulo="Comparativa entre nodos"
      nota="Cada nodo mide variables distintas: un panel y una escala por nodo, con el tiempo y el zoom compartidos."
      acciones={(
        <div className="flex flex-wrap gap-3">
          <SelectorVariable etiqueta="Nodo 1" variables={variables} valor={a} alCambiar={setA} />
          <SelectorVariable etiqueta="Nodo 2" variables={variables} valor={b} alCambiar={setB} />
        </div>
      )}
    >
      <Lienzo opcion={opcion} vacio={vacio} alto="h-96" mensaje={filtroNodo === 'todos' ? 'Sin datos de estas variables en este rango' : 'Selecciona "Todos los nodos" para comparar'} etiqueta="Comparativa de nodos" />
    </Tarjeta>
  );
}

export default function PanelVariables({ estado, lecturas, filtroNodo }) {
  const [tipo, setTipo] = useState('area');
  const hayHuecos = useMemo(() => crearEjeComprimido(lecturas).huecos.length > 0, [lecturas]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillToggle etiqueta="Tipo de gráfica" opciones={TIPOS_GRAFICA} valor={tipo} alCambiar={setTipo} />
        {lecturas?.baldeSeg > 0 && <p className="text-xs text-tinta-2">Por la cantidad de datos, cada punto promedia {Math.round(lecturas.baldeSeg / 60) || 1} min. Reduce el rango para ver cada lectura.</p>}
        {hayHuecos && <p className="text-xs text-tinta-2">Las franjas grises son periodos sin datos, recortados para que se vean las mediciones.</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {estado.variables.map((v) => (
          <Tarjeta key={v.clave} titulo={`${v.etiqueta}${v.unidad ? ` (${v.unidad})` : ''}`} nota={`Límite: ${textoLimite(v)}`}>
            <GraficaVariable variable={v} series={lecturas?.series[v.clave]} lecturas={lecturas} tipo={tipo} grupo="variables" margen={estado.margenCerca} />
          </Tarjeta>
        ))}
      </div>
      <Comparativa estado={estado} lecturas={lecturas} filtroNodo={filtroNodo} />
    </div>
  );
}

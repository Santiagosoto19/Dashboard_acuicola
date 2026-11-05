// Línea de tiempo del estado por nodo. Los segmentos crecen de izquierda a derecha al
// entrar, con escala y no con ancho. Los huecos sin datos se ven rayados.
import { useMemo } from 'react';
import { CheckCircle2, OctagonAlert, TriangleAlert } from 'lucide-react';
import Lienzo from './Lienzo';
import { NIVELES } from './Comunes';
import { C } from '../lib/colores';
import { aEje, duracion, fechaDeEje } from '../lib/formato';
import { ejeTiempo, patronRayado, TOOLTIP_VIDRIO, zoomTiempo } from '../lib/echarts';
import { tooltipSimple } from './tooltipVidrio';

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-2">
      <span className="flex items-center gap-1"><CheckCircle2 aria-hidden className="size-3.5 text-normal" strokeWidth={2.4} /> Normal</span>
      <span className="flex items-center gap-1"><TriangleAlert aria-hidden className="size-3.5 text-advertencia" strokeWidth={2.4} /> Advertencia</span>
      <span className="flex items-center gap-1"><OctagonAlert aria-hidden className="size-3.5 text-critica" strokeWidth={2.4} /> Crítica</span>
      <span className="flex items-center gap-1"><i aria-hidden className="rayado inline-block size-3 rounded-sm" /> Sin datos</span>
    </div>
  );
}

export default function LineaTiempo({ lecturas }) {
  const opcion = useMemo(() => {
    if (!lecturas) return null;
    const nodos = Object.keys(lecturas.lineaDeTiempo).sort((a, b) => a - b);
    const eje = ejeTiempo(lecturas);
    const datos = [];
    nodos.forEach((nodo, i) => {
      let cursor = eje.min;
      for (const [ini, fin, nivel] of lecturas.lineaDeTiempo[nodo]) {
        const a = aEje(ini);
        const b = aEje(fin);
        if (a > cursor) datos.push({ value: [i, cursor, a, 'hueco', nodo] });
        datos.push({ value: [i, a, b, nivel, nodo] });
        cursor = Math.max(cursor, b);
      }
      if (cursor < eje.max) datos.push({ value: [i, cursor, eje.max, 'hueco', nodo] });
    });

    return {
      grid: { left: 8, right: 16, top: 6, bottom: 42, containLabel: true },
      xAxis: eje,
      yAxis: {
        type: 'category',
        data: nodos.map((n) => `Nodo ${n}`),
        inverse: true,
        axisLabel: { color: C.tinta2 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      dataZoom: zoomTiempo(),
      tooltip: {
        ...TOOLTIP_VIDRIO,
        formatter: ({ value: [, ini, fin, nivel, nodo] }) => {
          const titulo = nivel === 'hueco' ? 'Sin datos' : NIVELES[nivel].etiqueta;
          return tooltipSimple(`<b>Nodo ${nodo}: ${titulo}</b><br><span class="num">Inicio: ${fechaDeEje(ini)}<br>Fin: ${fechaDeEje(fin)}<br>Duración: ${duracion(fin - ini)}</span>`);
        },
      },
      series: [{
        id: 'estados',
        type: 'custom',
        encode: { x: [1, 2], y: 0 },
        data: datos,
        renderItem: (params, api) => {
          const nivel = api.value(3);
          const inicio = api.coord([api.value(1), api.value(0)]);
          const fin = api.coord([api.value(2), api.value(0)]);
          const alto = Math.min(api.size([0, 1])[1] * 0.56, 34);
          const area = params.coordSys;
          // Recorte manual a la zona de la gráfica, para que el zoom no se salga.
          const x = Math.max(inicio[0], area.x);
          const ancho = Math.max(Math.min(fin[0], area.x + area.width) - x, nivel === 'hueco' ? 0 : 3);
          if (x > area.x + area.width || ancho <= 0) return null;
          return {
            type: 'rect',
            x,
            y: inicio[1] - alto / 2,
            shape: { x: 0, y: 0, width: ancho, height: alto, r: nivel === 'hueco' ? 0 : 3 },
            style: { fill: nivel === 'hueco' ? patronRayado() : C[nivel] },
            enterFrom: { scaleX: 0 },
            enterAnimation: { duration: 650, delay: params.dataIndex * 30, easing: 'cubicOut' },
          };
        },
      }],
    };
  }, [lecturas]);

  const vacio = !lecturas || Object.keys(lecturas.lineaDeTiempo).length === 0;
  return (
    <>
      <Leyenda />
      <Lienzo opcion={opcion} vacio={vacio} alto="h-52" etiqueta="Estado de cada nodo a lo largo del tiempo" />
    </>
  );
}

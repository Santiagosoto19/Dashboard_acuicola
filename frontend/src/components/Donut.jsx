// Donut de severidades. El centro muestra el total y, al pasar el cursor, el segmento.
// La leyenda es HTML: lleva icono, texto y conteo, y sigue legible sin el cursor.
import { useMemo, useState } from 'react';
import Lienzo from './Lienzo';
import { NIVELES } from './Comunes';
import { C } from '../lib/colores';

const ORDEN = ['normal', 'advertencia', 'critica'];

export default function Donut({ distribucion, alto = 'h-48' }) {
  const [activo, setActivo] = useState(null);
  const d = distribucion ?? { normal: 0, advertencia: 0, critica: 0 };
  const total = d.normal + d.advertencia + d.critica;
  const pct = (n) => (total ? `${((n / total) * 100).toFixed(1)}%` : '0%');

  const opcion = useMemo(() => ({
    tooltip: { show: false },
    series: [{
      id: 'severidades',
      type: 'pie',
      radius: ['62%', '86%'],
      center: ['50%', '50%'],
      selectedMode: 'single',
      selectedOffset: 7,
      animationType: 'expansion',
      animationDuration: 800,
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      emphasis: { scale: false },
      itemStyle: { borderColor: C.superficie, borderWidth: 2, borderRadius: 5 },
      data: ORDEN.filter((k) => d[k] > 0).map((k) => ({
        id: k, name: k, value: d[k], itemStyle: { color: C[k] },
      })),
    }],
  }), [d.normal, d.advertencia, d.critica]); // eslint-disable-line

  // El segmento activo se separa con la selección nativa de ECharts.
  const eventos = useMemo(() => ({
    mouseover: (p, chart) => {
      setActivo(p.name);
      chart.dispatchAction({ type: 'select', seriesIndex: 0, name: p.name });
    },
    mouseout: (p, chart) => {
      setActivo(null);
      chart.dispatchAction({ type: 'unselect', seriesIndex: 0, name: p.name });
    },
  }), []);

  const info = activo ? NIVELES[activo] : null;

  return (
    <div>
      <div className="relative">
        <Lienzo opcion={opcion} vacio={total === 0} alto={alto} eventos={eventos} etiqueta={`Distribución de severidades: ${ORDEN.map((k) => `${NIVELES[k].etiqueta} ${pct(d[k])}`).join(', ')}`} />
        {total > 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[28px] font-bold leading-none tracking-tight num">{info ? pct(d[activo]) : total}</span>
            <span className="mt-1 text-xs text-tinta-2">{info ? `${info.etiqueta} · ${d[activo]}` : 'mediciones'}</span>
          </div>
        )}
      </div>
      <ul className="mt-3 grid gap-1">
        {ORDEN.map((k) => {
          const n = NIVELES[k];
          return (
            <li key={k} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${activo === k ? 'bg-suave' : ''}`}>
              <span className="flex items-center gap-1.5">
                <n.Icono aria-hidden className="size-4" style={{ color: C[k] }} strokeWidth={2.4} />
                {n.etiqueta}
              </span>
              <span className="text-tinta-2 num">{d[k]} · {pct(d[k])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

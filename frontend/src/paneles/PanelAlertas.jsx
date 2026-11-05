// Alertas: conteos, barras por variable y nodo, % anormal, donut, tabla y eventos de la BD.
import { useMemo } from 'react';
import Lienzo from '../components/Lienzo';
import Donut from '../components/Donut';
import { PastillaNivel, Tarjeta } from '../components/Comunes';
import { C, colorNodo } from '../lib/colores';
import { conUnidad, fechaHora } from '../lib/formato';
import { EJE_VALOR, TOOLTIP_VIDRIO } from '../lib/echarts';
import { tooltipSimple } from '../components/tooltipVidrio';

const TIPOS_EVENTO = { lectura_fuera_rango: 'Fuera de rango', lectura_critica: 'Lectura crítica', lectura_invalida: 'Lectura inválida', sensor_caido: 'Sensor caído' };

export const TH = 'sticky top-0 bg-superficie px-3 py-2 text-left text-xs font-medium text-tinta-2 border-b border-borde-2 whitespace-nowrap';
export const TD = 'px-3 py-2 border-b border-borde whitespace-nowrap';

export default function PanelAlertas({ estado, lecturas, alertas }) {
  const variable = (c) => estado.variables.find((v) => v.clave === c);

  const barras = useMemo(() => {
    if (!alertas) return null;
    const claves = estado.variables.map((v) => v.clave).filter((c) => alertas.porVariable[c]);
    const nodos = [...new Set(claves.flatMap((c) => Object.keys(alertas.porVariable[c])))].sort((a, b) => a - b);
    return {
      vacio: claves.length === 0,
      opcion: {
        grid: { left: 8, right: 8, top: 46, bottom: 4, containLabel: true },
        legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: C.tinta2 } },
        xAxis: { type: 'category', data: claves.map((c) => variable(c).etiqueta), axisLabel: { color: C.tinta2, interval: 0 }, axisLine: { lineStyle: { color: C.eje } }, axisTick: { show: false } },
        yAxis: { ...EJE_VALOR, minInterval: 1 },
        tooltip: { ...TOOLTIP_VIDRIO, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'var(--grafica-sombra)' } } },
        series: nodos.map((n) => ({
          id: `nodo-${n}`, name: `Nodo ${n}`, type: 'bar', barMaxWidth: 28, barGap: '8%',
          itemStyle: { color: colorNodo(n), borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top', color: C.tinta2, fontSize: 11, formatter: (p) => p.value || '' },
          data: claves.map((c) => alertas.porVariable[c][n] ?? 0),
        })),
      },
    };
  }, [alertas, estado.variables]); // eslint-disable-line

  const pct = useMemo(() => {
    if (!lecturas) return null;
    const filas = lecturas.porcentajeAnormal.filter((f) => f.total > 0).sort((a, b) => a.pct - b.pct);
    return {
      vacio: filas.length === 0,
      opcion: {
        grid: { left: 8, right: 48, top: 8, bottom: 4, containLabel: true },
        xAxis: { ...EJE_VALOR, max: 100, axisLabel: { color: C.tinta3, formatter: '{value}%' } },
        yAxis: { type: 'category', data: filas.map((f) => variable(f.clave).etiqueta), axisLabel: { color: C.tinta2 }, axisLine: { lineStyle: { color: C.eje } }, axisTick: { show: false } },
        tooltip: {
          ...TOOLTIP_VIDRIO,
          formatter: (p) => {
            const f = filas[p.dataIndex];
            return tooltipSimple(`${variable(f.clave).etiqueta}: <b class="num">${f.pct}%</b><br>${f.anormales} de ${f.total} lecturas`);
          },
        },
        series: [{
          id: 'pct', type: 'bar', barMaxWidth: 20,
          itemStyle: { color: C.critica, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: C.tinta2, fontSize: 12, formatter: '{c}%' },
          data: filas.map((f) => f.pct),
        }],
      },
    };
  }, [lecturas, estado.variables]); // eslint-disable-line

  if (!alertas) return null;
  const cifras = [
    ['Alertas en el rango', alertas.total],
    ['En advertencia', alertas.porSeveridad.advertencia],
    ['En crítica', alertas.porSeveridad.critica],
    ['Eventos abiertos en BD', alertas.eventos.filter((e) => e.estado === 'abierto').length],
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cifras.map(([texto, valor]) => (
          <div key={texto} className="tarjeta p-4">
            <dd className="text-[32px] font-bold leading-none tracking-tight num">{valor}</dd>
            <dt className="mt-1.5 text-xs text-tinta-2">{texto}</dt>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Alertas por variable y nodo"><Lienzo opcion={barras?.opcion} vacio={barras?.vacio} mensaje="Sin alertas en este rango" etiqueta="Alertas por variable y nodo" /></Tarjeta>
        <Tarjeta titulo="Lecturas anormales por variable" nota="Porcentaje de las lecturas válidas del rango"><Lienzo opcion={pct?.opcion} vacio={pct?.vacio ?? true} etiqueta="Porcentaje de lecturas anormales por variable" /></Tarjeta>
        <Tarjeta titulo="Distribución de severidades" nota="Estado general en cada medición del rango"><Donut distribucion={alertas.distribucion} /></Tarjeta>
      </div>

      <Tarjeta titulo="Alertas recientes" nota={alertas.total > alertas.recientes.length ? `Las ${alertas.recientes.length} más recientes de ${alertas.total}. Severidad: estado general en ese instante.` : 'Severidad: estado general en ese instante. Crítica si había otra variable anormal al mismo tiempo.'}>
        <div className="max-h-96 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={TH}>Fecha y hora</th><th className={TH}>Nodo</th><th className={TH}>Variable</th><th className={`${TH} text-right`}>Valor</th><th className={TH}>Severidad</th></tr></thead>
            <tbody>
              {alertas.recientes.map((a) => (
                <tr key={`${a.ts}-${a.nodo}-${a.variable}`}>
                  <td className={`${TD} num`}>{fechaHora(a.ts)}</td>
                  <td className={TD}>Nodo {a.nodo}</td>
                  <td className={TD}>{variable(a.variable)?.etiqueta}</td>
                  <td className={`${TD} text-right num`}>{conUnidad(variable(a.variable), a.valor)}</td>
                  <td className={TD}><PastillaNivel nivel={a.severidad} /></td>
                </tr>
              ))}
              {alertas.recientes.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-tinta-3">Sin alertas en este rango</td></tr>}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Eventos registrados en la base de datos" nota="Tabla eventos, escrita por sp_procesar_evento_iot con los límites de la tabla variables. Tiene su propia escala de severidad y una fila por variable y tipo, así que sus números pueden diferir de los anteriores.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={TH}>Último registro</th><th className={TH}>Variable</th><th className={TH}>Tipo</th><th className={`${TH} text-right`}>Valor</th><th className={TH}>Severidad</th><th className={TH}>Estado</th><th className={`${TH} text-right`}>Repeticiones</th></tr></thead>
            <tbody>
              {alertas.eventos.map((e) => (
                <tr key={e.id}>
                  <td className={`${TD} num`}>{fechaHora(new Date(e.ultima_vez_en).getTime())}</td>
                  <td className={TD}>{e.variable ?? '—'}</td>
                  <td className={TD}>{TIPOS_EVENTO[e.tipo] ?? e.tipo}</td>
                  <td className={`${TD} text-right num`}>{e.valor ?? '—'}{e.unidad ? ` ${e.unidad}` : ''}</td>
                  <td className={TD}>{e.severidad}</td>
                  <td className={TD}>{e.estado}</td>
                  <td className={`${TD} text-right num`}>{e.repeticiones}</td>
                </tr>
              ))}
              {alertas.eventos.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-tinta-3">Sin eventos registrados en este rango</td></tr>}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

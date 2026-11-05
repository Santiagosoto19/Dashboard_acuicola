// Histórico: gráfica principal con tipo, mapa de calor, histograma y auditoría paginada.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import GraficaVariable, { TIPOS_GRAFICA } from '../components/GraficaVariable';
import Lienzo from '../components/Lienzo';
import { PillToggle, SelectorVariable, Tarjeta } from '../components/Comunes';
import { C, RAMPA_CALOR } from '../lib/colores';
import { conUnidad, fechaHora } from '../lib/formato';
import { EJE_VALOR, TOOLTIP_VIDRIO } from '../lib/echarts';
import { tooltipSimple } from '../components/tooltipVidrio';
import { consultaDe, pedirDatos } from '../hooks/useTablero';
import { TD, TH } from './PanelAlertas';

function Auditoria({ estado, filtros, demo, ciclo }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const clave = `${filtros.nodo}|${filtros.rango}|${filtros.desde}|${filtros.hasta}`;

  useEffect(() => setPagina(1), [clave]);
  useEffect(() => {
    let vigente = true;
    pedirDatos(`/api/auditoria?${consultaDe(filtros, estado.ultimaMedicion, { pagina })}`, demo)
      .then((d) => { if (vigente) { setDatos(d); setError(false); } })
      .catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
  }, [clave, pagina, ciclo, demo]); // eslint-disable-line

  return (
    <Tarjeta titulo="Auditoría de mediciones" nota="Cada medición con su estado. Un guion significa sin dato, no un valor anormal.">
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-critica-tinta">No se pudo cargar la auditoría. Se reintentará en el próximo refresco.</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={TH}>Fecha y hora</th>
              <th className={TH}>Nodo</th>
              {estado.variables.map((v) => <th key={v.clave} className={`${TH} text-right`}>{v.etiqueta}{v.unidad ? ` (${v.unidad})` : ''}</th>)}
              <th className={TH}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {datos?.filas.map((f) => (
              <tr key={`${f.paqueteId}-${f.nodo}`}>
                <td className={`${TD} num`}>{fechaHora(f.ts)}</td>
                <td className={TD}>Nodo {f.nodo}</td>
                {estado.variables.map((v) => {
                  const mal = f.anormales.includes(v.clave);
                  return <td key={v.clave} className={`${TD} text-right num ${mal ? 'font-semibold text-critica-tinta' : ''}`}>{f[v.clave] === null ? '—' : Number(f[v.clave]).toFixed(v.decimales)}</td>;
                })}
                <td className={TD}>
                  {f.estado === 'ANORMAL'
                    ? <span className="inline-flex items-center gap-1 font-semibold text-advertencia-tinta"><TriangleAlert aria-hidden className="size-4 text-advertencia" strokeWidth={2.4} /> ANORMAL</span>
                    : <span className="inline-flex items-center gap-1 font-semibold text-normal-tinta"><CheckCircle2 aria-hidden className="size-4 text-normal" strokeWidth={2.4} /> NORMAL</span>}
                </td>
              </tr>
            ))}
            {datos && datos.filas.length === 0 && <tr><td colSpan={estado.variables.length + 3} className="p-6 text-center text-tinta-3">Sin mediciones en este rango</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-sm text-tinta-2">
        <button type="button" disabled={!datos || datos.pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="h-9 rounded-lg border border-borde-2 px-3 font-semibold text-tinta disabled:text-tinta-3">Anterior</button>
        <span className="num">{datos ? `Página ${datos.pagina} de ${datos.paginas} · ${datos.total} mediciones` : '—'}</span>
        <button type="button" disabled={!datos || datos.pagina >= datos.paginas} onClick={() => setPagina((p) => p + 1)} className="h-9 rounded-lg border border-borde-2 px-3 font-semibold text-tinta disabled:text-tinta-3">Siguiente</button>
      </div>
    </Tarjeta>
  );
}

export default function PanelHistorico({ estado, lecturas, filtros, demo, ciclo }) {
  const variables = estado.variables;
  const primera = (claves) => claves.find((c) => lecturas?.series[c] && Object.keys(lecturas.series[c]).length) ?? claves[0];
  const [elegida, setElegida] = useState(null);
  const [tipo, setTipo] = useState('lineas');
  const [calorElegida, setCalor] = useState(null);
  const [histElegida, setHist] = useState(null);

  const todas = variables.map((v) => v.clave);
  const principal = elegida ?? primera(todas);
  const claveCalor = calorElegida ?? primera(todas);
  const claveHist = histElegida ?? primera(['turbidez', 'ph', ...todas]);
  const v = (c) => variables.find((x) => x.clave === c);

  const calor = useMemo(() => {
    if (!lecturas) return null;
    const mapa = lecturas.mapasDeCalor[claveCalor] ?? { dias: [], celdas: [] };
    const valores = mapa.celdas.map((c) => c[2]);
    const min = valores.length ? valores.reduce((a, b) => Math.min(a, b)) : 0;
    const max = valores.length ? valores.reduce((a, b) => Math.max(a, b)) : 1;
    const variable = v(claveCalor);
    return {
      vacio: !mapa.celdas.length,
      opcion: {
        grid: { left: 8, right: 16, top: 8, bottom: 62, containLabel: true },
        xAxis: {
          type: 'category', name: 'Hora del día (Bogotá)', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: C.tinta3 },
          data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
          axisLabel: { color: C.tinta3, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: C.eje } },
        },
        yAxis: { type: 'category', inverse: true, data: mapa.dias, axisLabel: { color: C.tinta2 }, axisTick: { show: false }, axisLine: { show: false } },
        visualMap: {
          type: 'continuous', min, max: max === min ? min + 1 : max, orient: 'horizontal', left: 'center', bottom: 0,
          itemHeight: 140, itemWidth: 10, text: [conUnidad(variable, max), conUnidad(variable, min)],
          textStyle: { color: C.tinta2, fontSize: 11 }, inRange: { color: RAMPA_CALOR }, dimension: 2,
        },
        tooltip: {
          ...TOOLTIP_VIDRIO,
          formatter: (p) => {
            const [h, d, prom, n] = p.value;
            return tooltipSimple(`${mapa.dias[d]}, ${String(h).padStart(2, '0')}:00<br>Promedio: <b class="num">${conUnidad(variable, prom)}</b><br>${n} lecturas`);
          },
        },
        series: [{ id: 'calor', type: 'heatmap', data: mapa.celdas, itemStyle: { borderColor: C.superficie, borderWidth: 2, borderRadius: 3 } }],
      },
    };
  }, [lecturas, claveCalor]); // eslint-disable-line

  const histograma = useMemo(() => {
    if (!lecturas) return null;
    const bins = lecturas.histogramas[claveHist] ?? [];
    const variable = v(claveHist);
    return {
      vacio: !bins.length,
      opcion: {
        grid: { left: 8, right: 16, top: 12, bottom: 32, containLabel: true },
        xAxis: {
          type: 'category', name: variable.unidad || variable.etiqueta, nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: C.tinta3 },
          data: bins.map((b) => String(Number(b.desde.toFixed(1)))), axisLabel: { color: C.tinta3, hideOverlap: true }, axisLine: { lineStyle: { color: C.eje } }, axisTick: { show: false },
        },
        yAxis: { ...EJE_VALOR, minInterval: 1 },
        tooltip: {
          ...TOOLTIP_VIDRIO,
          formatter: (p) => {
            const b = bins[p.dataIndex];
            return tooltipSimple(`<span class="num">${b.desde} – ${b.hasta}</span> ${variable.unidad}<br><b class="num">${b.n}</b> lecturas${b.anormal ? '<br>Fuera de límites' : ''}`);
          },
        },
        series: [{
          id: 'hist', type: 'bar', barCategoryGap: 2,
          data: bins.map((b) => ({ value: b.n, itemStyle: { color: b.anormal ? C.critica : C.sin_dato, borderRadius: [3, 3, 0, 0] } })),
        }],
      },
    };
  }, [lecturas, claveHist]); // eslint-disable-line

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Serie histórica"
        nota="Arrastra sobre la barra inferior para acotar el periodo."
        acciones={(
          <div className="flex flex-wrap items-end gap-3">
            <SelectorVariable etiqueta="Variable" variables={variables} valor={principal} alCambiar={setElegida} />
            <PillToggle etiqueta="Tipo de gráfica" opciones={TIPOS_GRAFICA} valor={tipo} alCambiar={setTipo} />
          </div>
        )}
      >
        <GraficaVariable variable={v(principal)} series={lecturas?.series[principal]} lecturas={lecturas} tipo={tipo} margen={estado.margenCerca} alto="h-96" />
      </Tarjeta>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Mapa de calor por hora y día" acciones={<SelectorVariable etiqueta="Variable" variables={variables} valor={claveCalor} alCambiar={setCalor} />}>
          <Lienzo opcion={calor?.opcion} vacio={calor?.vacio ?? true} alto="h-80" mensaje={`Sin lecturas de ${v(claveCalor).etiqueta} en este rango`} etiqueta="Mapa de calor por hora y día" />
        </Tarjeta>
        <Tarjeta titulo="Histograma" nota="Rojo: fuera de límites. Gris: dentro de límites." acciones={<SelectorVariable etiqueta="Variable" variables={variables} valor={claveHist} alCambiar={setHist} />}>
          <Lienzo opcion={histograma?.opcion} vacio={histograma?.vacio ?? true} alto="h-80" mensaje={`Sin lecturas de ${v(claveHist).etiqueta} en este rango`} etiqueta="Histograma de lecturas" />
        </Tarjeta>
      </div>

      <Auditoria estado={estado} filtros={filtros} demo={demo} ciclo={ciclo} />
    </div>
  );
}

// Cliente del dashboard: consulta la API cada 10 s y dibuja con Apache ECharts.
'use strict';

const ZONA = 'America/Bogota';
const REFRESCO_MS = 10 * 1000;
const DIA_MS = 24 * 3600 * 1000;
// Colombia no tiene horario de verano. ECharts dibuja en UTC y los tiempos se
// desplazan -5 h, así el eje siempre muestra hora de Bogotá en cualquier navegador.
const DESFASE_MS = -5 * 3600 * 1000;
const aEje = (ts) => ts + DESFASE_MS;

const COLOR = {
  superficie: '#1a1a19',
  tinta: '#f0efec',
  tinta2: '#c3c2b7',
  tenue: '#898781',
  linea: '#2c2c2a',
  eje: '#383835',
  normal: '#0ca30c',
  advertencia: '#fab219',
  critica: '#d03b3b',
};
// El color sigue al nodo: filtrar no cambia el color de los que quedan.
const COLOR_NODOS = ['#3987e5', '#d95926', '#199e70'];
const colorNodo = (nodo) => COLOR_NODOS[(Number(nodo) - 1) % COLOR_NODOS.length];
const RAMPA_CALOR = ['#184f95', '#3987e5', '#86b6ef', '#cde2fb'];

const NIVELES = {
  normal: { etiqueta: 'Normal', icono: '✅' },
  advertencia: { etiqueta: 'Advertencia', icono: '⚠️' },
  critica: { etiqueta: 'Crítica', icono: '🚨' },
  sin_datos: { etiqueta: 'Sin datos', icono: '—' },
};

const estadoApp = {
  pestana: 'resumen',
  nodo: 'todos',
  rango: '24h',
  desdePersonal: null,
  hastaPersonal: null,
  pagina: 1,
  rangoAuto: false, // true si se cambió solo al rango de la última medición
  secuencia: 0, // descarta respuestas de peticiones viejas
  estado: null,
  lecturas: null,
  alertas: null,
  telemetria: null,
  auditoria: null,
};

const $ = (id) => document.getElementById(id);

// Todo texto que venga de la API se escapa antes de insertarlo como HTML.
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const fmtFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const fechaHora = (ts) => (ts === null || ts === undefined ? '—' : fmtFechaHora.format(new Date(ts)));

function hace(ts) {
  if (ts === null || ts === undefined) return '';
  const seg = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h`;
  const dias = Math.round(seg / 86400);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

const variables = () => estadoApp.estado?.variables ?? [];
const variable = (clave) => variables().find((v) => v.clave === clave);
const etiquetaVar = (clave) => variable(clave)?.etiqueta ?? clave;

function conUnidad(clave, valor) {
  const v = variable(clave);
  if (valor === null || valor === undefined) return '—';
  const n = v ? Number(valor).toFixed(v.decimales) : String(valor);
  return v?.unidad ? `${n} ${v.unidad}` : n;
}

function textoLimite(limite, unidad) {
  const u = unidad ? ` ${unidad}` : '';
  if (limite.min !== undefined && limite.max !== undefined) return `${limite.min}–${limite.max}${u}`;
  if (limite.max !== undefined) return `máx. ${limite.max}${u}`;
  if (limite.min !== undefined) return `mín. ${limite.min}${u}`;
  return 'sin límite';
}

function esAnormal(clave, valor) {
  const limite = variable(clave)?.limite;
  if (!limite || valor === null || valor === undefined) return false;
  return (limite.min !== undefined && valor < limite.min) || (limite.max !== undefined && valor > limite.max);
}

function pastillaNivel(nivel) {
  const n = NIVELES[nivel] ?? NIVELES.sin_datos;
  return `<span class="pastilla" data-nivel="${esc(nivel)}">${n.icono} ${n.etiqueta}</span>`;
}

function pastillaConexion(conexion) {
  return conexion === 'en_linea'
    ? '<span class="pastilla" data-nivel="normal">● En línea</span>'
    : '<span class="pastilla">○ Sin comunicación</span>';
}

/* ---------- Gráficas: ayudantes ---------- */

const graficas = new Map();

function grafica(id) {
  if (graficas.has(id)) return graficas.get(id);
  const elemento = $(id);
  const instancia = echarts.init(elemento, null, { locale: 'ES', useUTC: true });
  new ResizeObserver(() => instancia.resize()).observe(elemento);
  graficas.set(id, instancia);
  return instancia;
}

// replaceMerge sustituye las series pero conserva el zoom que eligió el usuario.
function dibujar(id, opcion, vacio, mensaje = 'Sin datos en este rango') {
  const elemento = $(id);
  const instancia = grafica(id);
  elemento.dataset.vacio = vacio ? 'true' : 'false';
  elemento.dataset.mensaje = mensaje;
  if (vacio) return;
  instancia.setOption(
    { animation: false, backgroundColor: 'transparent', textStyle: { color: COLOR.tinta2, fontFamily: 'system-ui, sans-serif' }, ...opcion },
    { replaceMerge: ['series'] },
  );
  instancia.resize();
}

const estiloTooltip = {
  backgroundColor: '#232322',
  borderColor: 'rgba(255,255,255,0.15)',
  textStyle: { color: COLOR.tinta, fontSize: 12 },
  confine: true,
};
const ejeValor = {
  type: 'value',
  axisLabel: { color: COLOR.tenue, hideOverlap: true },
  splitLine: { lineStyle: { color: COLOR.linea, width: 1 } },
  axisLine: { show: false },
};
// El eje se ajusta a los datos del rango: si solo hay 25 min dentro de 24 h, se
// ven esos 25 min y no una franja ilegible en un extremo. El eje muestra las horas
// reales, y todas las gráficas comparten la misma ventana.
const ejeTiempo = (l) => {
  const inicio = l.primerDato ?? l.desde;
  const fin = l.ultimoDato ?? l.hasta;
  const margen = Math.max((fin - inicio) * 0.02, 30 * 1000);
  return {
  type: 'time',
  min: aEje(inicio - margen),
  max: aEje(fin + margen),
  axisLabel: { color: COLOR.tenue, hideOverlap: true, fontSize: 11 },
  axisLine: { lineStyle: { color: COLOR.eje } },
  splitLine: { show: false },
  };
};
const horaTooltip = (tsEje) => fmtFechaHora.format(new Date(tsEje - DESFASE_MS));

// El eje incluye los dos umbrales aunque los datos no los alcancen o los superen;
// si no, la línea de umbral quedaría fuera de la gráfica. Mínimo, máximo e intervalo
// se calculan juntos para que las marcas caigan en valores redondos.
function escalaY(limite, puntos) {
  const valores = puntos.map((p) => p[1]).filter((v) => v !== null);
  const cotas = [limite.min, limite.max].filter((x) => x !== undefined);
  const todos = [...valores, ...cotas];
  if (!todos.length) return {};
  const bajo = todos.reduce((a, b) => Math.min(a, b));
  const alto = todos.reduce((a, b) => Math.max(a, b));
  const tramo = alto - bajo || 1;
  const magnitud = 10 ** Math.floor(Math.log10(tramo / 5));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((x) => tramo / x <= 6) ?? 10 * magnitud;
  const redondear = (x) => Number(x.toFixed(4));
  const minimo = Math.floor((bajo - tramo * 0.03) / paso) * paso;
  return {
    // Una variable sin valores negativos no debe mostrar un eje negativo.
    min: redondear(bajo >= 0 ? Math.max(0, minimo) : minimo),
    max: redondear(Math.ceil((alto + tramo * 0.03) / paso) * paso),
    interval: redondear(paso),
  };
}

function lineasDeUmbral(limite) {
  const datos = [];
  if (limite.min !== undefined) datos.push({ yAxis: limite.min, label: { formatter: `mín ${limite.min}` } });
  if (limite.max !== undefined) datos.push({ yAxis: limite.max, label: { formatter: `máx ${limite.max}` } });
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: COLOR.advertencia, type: 'dashed', width: 1 },
    label: { color: COLOR.tinta2, position: 'insideStartTop', fontSize: 11 },
    data: datos,
  };
}

function serieDeNodo(nodo, puntos, extra = {}) {
  return {
    name: `Nodo ${nodo}`,
    type: 'line',
    data: puntos.map(([ts, valor]) => [aEje(ts), valor]),
    showSymbol: puntos.length < 120,
    symbol: 'circle',
    symbolSize: 6,
    connectNulls: false,
    lineStyle: { width: 2, color: colorNodo(nodo) },
    itemStyle: { color: colorNodo(nodo) },
    ...extra,
  };
}

const zoomTiempo = (extra = {}) => [
  { type: 'inside', ...extra },
  {
    type: 'slider', height: 18, bottom: 6, borderColor: COLOR.linea, textStyle: { color: COLOR.tenue },
    fillerColor: 'rgba(255,255,255,0.08)', showDetail: false, showDataShadow: false, moveHandleSize: 0, brushSelect: false, ...extra,
  },
];

function tooltipLinea(clave) {
  return {
    ...estiloTooltip,
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: COLOR.tenue } },
    formatter: (params) => {
      const filas = params
        .filter((p) => p.value[1] !== null && p.value[1] !== undefined)
        .map((p) => {
          const aviso = esAnormal(clave, p.value[1]) ? ' ⚠️' : '';
          return `${p.marker}${esc(p.seriesName)}: <b>${esc(conUnidad(clave, p.value[1]))}</b>${aviso}`;
        });
      return filas.length ? `${horaTooltip(params[0].value[0])}<br>${filas.join('<br>')}` : '';
    },
  };
}

/* ---------- Encabezado ---------- */

function pintarBanner() {
  const e = estadoApp.estado;
  if (!e) return;
  const n = NIVELES[e.nivel] ?? NIVELES.sin_datos;
  $('banner').dataset.nivel = e.nivel;
  $('banner-icono').textContent = n.icono;
  $('banner-nivel').textContent = n.etiqueta;

  const anormales = e.nodos.flatMap((nodo) => nodo.anormales.map((c) => `${etiquetaVar(c)} (nodo ${nodo.nodo})`));
  let detalle = {
    normal: 'Todas las variables están dentro de los límites.',
    sin_datos: 'Aún no hay mediciones registradas.',
  }[e.nivel] ?? `Fuera de límites: ${anormales.join(', ')}.`;
  if (e.nodos.length && e.nodos.every((nodo) => nodo.conexion !== 'en_linea')) {
    detalle += ' Ningún nodo está reportando: este es el último estado conocido.';
  }
  $('banner-detalle').textContent = detalle;
  $('banner-hora').textContent = fechaHora(e.ultimaMedicion);
  $('banner-antiguedad').textContent = e.ultimaMedicion ? `${hace(e.ultimaMedicion)} · hora de Bogotá` : '';
}

function pintarConexion(ok) {
  $('conexion').dataset.estado = ok ? 'vivo' : 'error';
  $('conexion-texto').textContent = ok ? 'Servidor conectado' : 'Sin conexión con el servidor';
  const hayDatos = Boolean(estadoApp.estado);
  $('conexion-hora').textContent = ok
    ? `Actualizado ${fmtHora.format(new Date())} · cada 10 s`
    : hayDatos ? 'Se muestran los últimos datos recibidos' : 'Reintentando cada 10 s';
  if (!ok && !hayDatos) {
    document.querySelectorAll('.lienzo').forEach((l) => {
      l.dataset.vacio = 'true';
      l.dataset.mensaje = 'Datos no disponibles por el momento';
    });
    $('banner-nivel').textContent = 'Sin datos';
    $('banner-icono').textContent = '—';
    $('banner-detalle').textContent = 'No fue posible consultar los datos. Se reintentará en 10 s.';
  }
}

/* ---------- Pestaña Resumen ---------- */

function htmlTarjetaNodo(n) {
  const filas = variables()
    .filter((v) => n.lecturas[v.clave]?.vigente)
    .map((v) => {
      const l = n.lecturas[v.clave];
      let delta = 'sin lectura previa';
      if (l.variacion !== null) {
        const flecha = l.variacion > 0 ? '▲' : l.variacion < 0 ? '▼' : '=';
        const signo = l.variacion > 0 ? '+' : '';
        delta = `${flecha} ${signo}${Number(l.variacion.toFixed(v.decimales))}`;
      }
      return `<tr>
        <td>${esc(v.etiqueta)}</td>
        <td class="${l.anormal ? 'valor-anormal' : ''}">${l.anormal ? '⚠️ ' : ''}${esc(conUnidad(v.clave, l.valor))}</td>
        <td class="delta" title="Variación respecto a la lectura anterior">${esc(delta)}</td>
      </tr>`;
    }).join('');

  return `<article class="tarjeta">
    <div class="nodo__cabecera">
      <div class="nodo__titulo"><span class="muestra-nodo" style="background:${colorNodo(n.nodo)}"></span>Nodo ${esc(n.nodo)}</div>
      <div>${pastillaNivel(n.nivel)} ${pastillaConexion(n.conexion)}</div>
    </div>
    <p class="nodo__meta">${n.ultimaHora ? `${esc(fechaHora(n.ultimaHora))} · ${esc(hace(n.ultimaHora))}` : 'Sin mediciones'}</p>
    <table class="lecturas"><tbody>${filas || '<tr><td class="tenue">Sin lecturas recientes</td></tr>'}</tbody></table>
  </article>`;
}

function nodosVisibles() {
  const nodos = estadoApp.estado?.nodos ?? [];
  return estadoApp.nodo === 'todos' ? nodos : nodos.filter((n) => String(n.nodo) === estadoApp.nodo);
}

function pintarTarjetasNodos(idContenedor) {
  $(idContenedor).innerHTML = nodosVisibles().map(htmlTarjetaNodo).join('');
}

// Crea los contenedores de una vez, para no reiniciar las gráficas en cada refresco.
function prepararGauges() {
  if ($('gauges').children.length || !variables().length) return;
  $('gauges').innerHTML = variables().map((v) => `<article class="tarjeta gauge">
    <h3>${esc(v.etiqueta)}</h3>
    <div class="lienzo lienzo--gauge" id="gauge-${v.clave}"></div>
    <div class="gauge__pie" id="gauge-pie-${v.clave}"></div>
  </article>`).join('');
}

function bandasGauge(v) {
  const [a, b] = v.escala;
  const posicion = (x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const bandas = [];
  if (v.limite.min !== undefined) bandas.push([posicion(v.limite.min), COLOR.advertencia]);
  if (v.limite.max !== undefined) {
    bandas.push([posicion(v.limite.max), COLOR.normal], [1, COLOR.advertencia]);
  } else {
    bandas.push([1, COLOR.normal]);
  }
  return bandas;
}

function pintarGauges() {
  prepararGauges();
  const nodos = nodosVisibles();
  for (const v of variables()) {
    // Si dos nodos reportan la misma variable, se muestra la lectura más reciente.
    const candidatos = nodos
      .filter((n) => n.lecturas[v.clave]?.vigente)
      .map((n) => ({ nodo: n.nodo, ...n.lecturas[v.clave] }))
      .sort((a, b) => b.ts - a.ts);
    const lectura = candidatos[0] ?? null;
    const [a, b] = v.escala;
    const pasos = 4;

    dibujar(`gauge-${v.clave}`, {
      series: [{
        type: 'gauge',
        min: a,
        max: b,
        startAngle: 210,
        endAngle: -30,
        radius: '95%',
        center: ['50%', '55%'],
        splitNumber: pasos,
        axisLine: { lineStyle: { width: 8, color: bandasGauge(v) } },
        pointer: { show: lectura !== null, length: '62%', width: 4, itemStyle: { color: COLOR.tinta } },
        anchor: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { distance: 12, color: COLOR.tenue, fontSize: 10, formatter: (x) => (Math.abs(x - a) < 1e-6 || Math.abs(x - b) < 1e-6 ? x : '') },
        title: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, '68%'],
          fontSize: 20,
          fontWeight: 600,
          color: lectura ? COLOR.tinta : COLOR.tenue,
          // La aguja se recorta a la escala, pero el texto muestra el valor real.
          formatter: () => (lectura ? conUnidad(v.clave, lectura.valor) : 'Sin dato'),
        },
        data: [{ value: lectura ? Math.min(b, Math.max(a, lectura.valor)) : a }],
      }],
    }, false);

    const estado = !lectura ? '<span class="tenue">Sin lectura reciente</span>'
      : lectura.anormal ? '⚠️ Fuera de límites' : '✅ Dentro de límites';
    $(`gauge-pie-${v.clave}`).innerHTML = `<span>${estado}</span>
      <span class="tenue">Límite: ${esc(textoLimite(v.limite, v.unidad))}${lectura ? ` · Nodo ${esc(lectura.nodo)}` : ''}</span>`;
  }
}

function pintarLineaDeTiempo() {
  const l = estadoApp.lecturas;
  if (!l) return;
  const nodos = Object.keys(l.lineaDeTiempo).sort((a, b) => a - b);
  const datos = nodos.flatMap((nodo, i) => l.lineaDeTiempo[nodo].map(([ini, fin, nivel]) => ({
    value: [i, aEje(ini), aEje(fin), nivel, nodo],
    itemStyle: { color: COLOR[nivel] },
  })));

  dibujar('g-linea-tiempo', {
    grid: { left: 8, right: 16, top: 8, bottom: 44, containLabel: true },
    xAxis: ejeTiempo(l),
    yAxis: {
      type: 'category',
      data: nodos.map((n) => `Nodo ${n}`),
      inverse: true,
      axisLabel: { color: COLOR.tinta2 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    dataZoom: zoomTiempo({ filterMode: 'none' }),
    tooltip: {
      ...estiloTooltip,
      formatter: ({ value: [, ini, fin, nivel, nodo] }) => `<b>Nodo ${esc(nodo)}: ${NIVELES[nivel].icono} ${NIVELES[nivel].etiqueta}</b><br>
        Desde ${horaTooltip(ini)}<br>Hasta ${horaTooltip(fin)}`,
    },
    series: [{
      type: 'custom',
      encode: { x: [1, 2], y: 0 },
      data: datos,
      renderItem: (params, api) => {
        const inicio = api.coord([api.value(1), api.value(0)]);
        const fin = api.coord([api.value(2), api.value(0)]);
        const alto = Math.min(api.size([0, 1])[1] * 0.55, 36);
        // Ancho mínimo: una sola medición sigue siendo visible y se puede señalar.
        const forma = echarts.graphic.clipRectByRect(
          { x: inicio[0], y: inicio[1] - alto / 2, width: Math.max(fin[0] - inicio[0], 3), height: alto },
          { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height },
        );
        return forma && { type: 'rect', shape: forma, style: api.style() };
      },
    }],
  }, datos.length === 0);
}

function opcionDonut() {
  const d = estadoApp.alertas.distribucion;
  const total = d.normal + d.advertencia + d.critica;
  return {
    total,
    opcion: {
      tooltip: {
        ...estiloTooltip,
        formatter: (p) => `${p.marker}${esc(p.name)}: <b>${p.value}</b> mediciones (${p.percent}%)`,
      },
      legend: { bottom: 0, textStyle: { color: COLOR.tinta2, fontSize: 12 }, itemWidth: 10, itemHeight: 10 },
      graphic: [{
        type: 'text', left: 'center', top: '38%', silent: true,
        style: { text: `${total}\nmediciones`, fill: COLOR.tinta, font: '600 15px system-ui', textAlign: 'center', lineHeight: 20 },
      }],
      series: [{
        type: 'pie',
        radius: ['55%', '78%'],
        center: ['50%', '45%'],
        itemStyle: { borderColor: COLOR.superficie, borderWidth: 2, borderRadius: 4 },
        label: { color: COLOR.tinta2, fontSize: 12, formatter: '{d}%' },
        labelLine: { lineStyle: { color: COLOR.eje } },
        data: [
          { name: '✅ Normal', value: d.normal, itemStyle: { color: COLOR.normal } },
          { name: '⚠️ Advertencia', value: d.advertencia, itemStyle: { color: COLOR.advertencia } },
          { name: '🚨 Crítica', value: d.critica, itemStyle: { color: COLOR.critica } },
        ].filter((s) => s.value > 0),
      }],
    },
  };
}

function pintarDonut(id) {
  if (!estadoApp.alertas) return;
  const { total, opcion } = opcionDonut();
  dibujar(id, opcion, total === 0);
}

function pintarResumen() {
  pintarTarjetasNodos('tarjetas-nodos');
  pintarGauges();
  pintarLineaDeTiempo();
  pintarDonut('g-donut');
}

/* ---------- Pestaña Variables ---------- */

function prepararLineas() {
  if ($('lineas').children.length || !variables().length) return;
  $('lineas').innerHTML = variables().map((v) => `<article class="tarjeta">
    <h3>${esc(v.etiqueta)}${v.unidad ? ` (${esc(v.unidad)})` : ''}</h3>
    <p class="nota">Límite: ${esc(textoLimite(v.limite, v.unidad))}</p>
    <div class="lienzo" id="linea-${v.clave}"></div>
  </article>`).join('');
}

function pintarVariables() {
  const l = estadoApp.lecturas;
  if (!l) return;
  prepararLineas();

  const nota = $('nota-promedio');
  nota.hidden = !l.baldeSeg;
  if (l.baldeSeg) nota.textContent = `Por la cantidad de datos, cada punto promedia ${Math.round(l.baldeSeg / 60) || 1} min. Reduzca el rango para ver cada lectura.`;

  for (const v of variables()) {
    const porNodo = l.series[v.clave] ?? {};
    const nodos = Object.keys(porNodo).sort((a, b) => a - b);
    dibujar(`linea-${v.clave}`, {
      grid: { left: 8, right: 16, top: 34, bottom: 44, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { color: COLOR.tinta2 }, itemWidth: 14, itemHeight: 8 },
      xAxis: ejeTiempo(l),
      yAxis: { ...ejeValor, ...escalaY(v.limite, nodos.flatMap((n) => porNodo[n])) },
      dataZoom: zoomTiempo({ filterMode: 'none' }),
      tooltip: tooltipLinea(v.clave),
      series: nodos.map((n, i) => serieDeNodo(n, porNodo[n], i === 0 ? { markLine: lineasDeUmbral(v.limite) } : {})),
    }, nodos.length === 0, `Sin lecturas de ${v.etiqueta} en este rango`);
  }
  pintarComparativa();
}

// Rellena un selector de variables conservando la opción elegida. Si el usuario
// no ha elegido, toma la primera variable que tenga datos.
function llenarSelector(select, claves) {
  const previo = select.dataset.elegido || '';
  const opciones = variables().map((v) => `<option value="${v.clave}">${esc(v.etiqueta)}</option>`).join('');
  if (select.innerHTML !== opciones) select.innerHTML = opciones;
  select.value = previo || claves[0] || variables()[0]?.clave || '';
}

function pintarComparativa() {
  const l = estadoApp.lecturas;
  const tieneDatos = (nodo) => variables().map((v) => v.clave).filter((c) => l.series[c]?.[nodo]?.length);
  const selA = $('comparar-a');
  const selB = $('comparar-b');
  llenarSelector(selA, tieneDatos(1));
  llenarSelector(selB, tieneDatos(2));

  const paneles = [{ nodo: 1, clave: selA.value }, { nodo: 2, clave: selB.value }];
  const hayDatos = paneles.some((p) => l.series[p.clave]?.[p.nodo]?.length);
  const bajo = (i) => ({ ...ejeTiempo(l), gridIndex: i, axisLabel: { color: COLOR.tenue, hideOverlap: true, fontSize: 11, show: i === 1 } });

  dibujar('g-comparativa', {
    grid: [
      { left: 8, right: 16, top: 26, height: '36%', containLabel: true },
      { left: 8, right: 16, top: '54%', height: '32%', containLabel: true },
    ],
    title: paneles.map((p, i) => ({
      text: `Nodo ${p.nodo}: ${etiquetaVar(p.clave)}${variable(p.clave)?.unidad ? ` (${variable(p.clave).unidad})` : ''}`,
      top: i === 0 ? 0 : '47%',
      left: 8,
      textStyle: { color: COLOR.tinta2, fontSize: 12, fontWeight: 550 },
    })),
    xAxis: [bajo(0), bajo(1)],
    yAxis: paneles.map((p, i) => ({ ...ejeValor, gridIndex: i, ...escalaY(variable(p.clave)?.limite ?? {}, l.series[p.clave]?.[p.nodo] ?? []) })),
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    dataZoom: zoomTiempo({ xAxisIndex: [0, 1], filterMode: 'none' }),
    tooltip: {
      ...estiloTooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: COLOR.tenue } },
      formatter: (params) => {
        const filas = params.filter((p) => p.value[1] !== null).map((p) => {
          const clave = paneles[p.seriesIndex].clave;
          return `${p.marker}${esc(p.seriesName)}, ${esc(etiquetaVar(clave))}: <b>${esc(conUnidad(clave, p.value[1]))}</b>${esAnormal(clave, p.value[1]) ? ' ⚠️' : ''}`;
        });
        return filas.length ? `${horaTooltip(params[0].value[0])}<br>${filas.join('<br>')}` : '';
      },
    },
    series: paneles.map((p, i) => serieDeNodo(p.nodo, l.series[p.clave]?.[p.nodo] ?? [], {
      xAxisIndex: i,
      yAxisIndex: i,
      markLine: lineasDeUmbral(variable(p.clave)?.limite ?? {}),
    })),
  }, !hayDatos, estadoApp.nodo === 'todos' ? 'Sin datos de estas variables en este rango' : 'Seleccione "Todos los nodos" para comparar');
}

/* ---------- Pestaña Alertas ---------- */

function pintarCifras() {
  const a = estadoApp.alertas;
  const cifras = [
    ['Alertas en el rango', a.total],
    ['⚠️ En advertencia', a.porSeveridad.advertencia],
    ['🚨 En crítica', a.porSeveridad.critica],
    ['Eventos abiertos en BD', a.eventos.filter((e) => e.estado === 'abierto').length],
  ];
  $('cifras-alertas').innerHTML = cifras.map(([texto, valor]) => `<div class="cifra"><b>${esc(valor)}</b><span>${esc(texto)}</span></div>`).join('');
}

function pintarBarrasAlertas() {
  const { porVariable } = estadoApp.alertas;
  const claves = variables().map((v) => v.clave).filter((c) => porVariable[c]);
  const nodos = [...new Set(claves.flatMap((c) => Object.keys(porVariable[c])))].sort((a, b) => a - b);
  dibujar('g-alertas-barras', {
    grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { color: COLOR.tinta2 }, itemWidth: 10, itemHeight: 10 },
    xAxis: {
      type: 'category',
      data: claves.map(etiquetaVar),
      axisLabel: { color: COLOR.tinta2, interval: 0, hideOverlap: true },
      axisLine: { lineStyle: { color: COLOR.eje } },
      axisTick: { show: false },
    },
    yAxis: { ...ejeValor, minInterval: 1 },
    tooltip: { ...estiloTooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: nodos.map((n) => ({
      name: `Nodo ${n}`,
      type: 'bar',
      barMaxWidth: 28,
      barGap: '8%',
      itemStyle: { color: colorNodo(n), borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', color: COLOR.tinta2, fontSize: 11, formatter: (p) => p.value || '' },
      data: claves.map((c) => porVariable[c][n] ?? 0),
    })),
  }, claves.length === 0, 'Sin alertas en este rango');
}

function pintarPctAnormal() {
  const l = estadoApp.lecturas;
  if (!l) return;
  const filas = l.porcentajeAnormal.filter((f) => f.total > 0).sort((a, b) => a.pct - b.pct);
  dibujar('g-pct-anormal', {
    grid: { left: 8, right: 44, top: 8, bottom: 4, containLabel: true },
    xAxis: { ...ejeValor, max: 100, axisLabel: { color: COLOR.tenue, formatter: '{value}%' } },
    yAxis: {
      type: 'category',
      data: filas.map((f) => etiquetaVar(f.clave)),
      axisLabel: { color: COLOR.tinta2 },
      axisLine: { lineStyle: { color: COLOR.eje } },
      axisTick: { show: false },
    },
    tooltip: {
      ...estiloTooltip,
      formatter: (p) => {
        const f = filas[p.dataIndex];
        return `${esc(etiquetaVar(f.clave))}: <b>${f.pct}%</b><br>${f.anormales} de ${f.total} lecturas`;
      },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: { color: COLOR.advertencia, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: COLOR.tinta2, fontSize: 12, formatter: '{c}%' },
      data: filas.map((f) => f.pct),
    }],
  }, filas.length === 0);
}

function pintarTablaAlertas() {
  const a = estadoApp.alertas;
  $('nota-alertas').textContent = a.total > a.recientes.length
    ? `Mostrando las ${a.recientes.length} más recientes de ${a.total}. La severidad es el estado general en ese instante.`
    : 'La severidad es el estado general en ese instante: crítica si había otra variable anormal al mismo tiempo.';
  $('tabla-alertas').innerHTML = a.recientes.map((x) => `<tr>
    <td>${esc(fechaHora(x.ts))}</td>
    <td>Nodo ${esc(x.nodo)}</td>
    <td>${esc(etiquetaVar(x.variable))}</td>
    <td class="num">${esc(conUnidad(x.variable, x.valor))}</td>
    <td>${pastillaNivel(x.severidad)}</td>
  </tr>`).join('') || '<tr><td class="vacia" colspan="5">Sin alertas en este rango</td></tr>';

  const tipos = { lectura_fuera_rango: 'Fuera de rango', lectura_critica: 'Lectura crítica', lectura_invalida: 'Lectura inválida', sensor_caido: 'Sensor caído' };
  $('tabla-eventos').innerHTML = a.eventos.map((e) => `<tr>
    <td>${esc(fechaHora(new Date(e.ultima_vez_en).getTime()))}</td>
    <td>${esc(e.variable ?? '—')}</td>
    <td>${esc(tipos[e.tipo] ?? e.tipo)}</td>
    <td class="num">${esc(e.valor ?? '—')}${e.unidad ? ` ${esc(e.unidad)}` : ''}</td>
    <td>${esc(e.severidad)}</td>
    <td>${esc(e.estado)}</td>
    <td class="num">${esc(e.repeticiones)}</td>
  </tr>`).join('') || '<tr><td class="vacia" colspan="7">Sin eventos registrados en este rango</td></tr>';
}

function pintarAlertas() {
  if (!estadoApp.alertas) return;
  pintarCifras();
  pintarBarrasAlertas();
  pintarPctAnormal();
  pintarDonut('g-donut-alertas');
  pintarTablaAlertas();
}

/* ---------- Pestaña Histórico ---------- */

function pintarHeatmap() {
  const l = estadoApp.lecturas;
  if (!l) return;
  const disponibles = Object.keys(l.mapasDeCalor).filter((c) => l.mapasDeCalor[c].celdas.length);
  const select = $('heatmap-variable');
  llenarSelector(select, disponibles);
  const clave = select.value;
  const mapa = l.mapasDeCalor[clave] ?? { dias: [], celdas: [] };
  const valores = mapa.celdas.map((c) => c[2]);
  const minimo = valores.length ? valores.reduce((a, b) => Math.min(a, b)) : 0;
  const maximo = valores.length ? valores.reduce((a, b) => Math.max(a, b)) : 1;

  dibujar('g-heatmap', {
    grid: { left: 8, right: 16, top: 8, bottom: 58, containLabel: true },
    xAxis: {
      type: 'category',
      name: 'Hora del día (Bogotá)',
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle: { color: COLOR.tenue },
      data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
      axisLabel: { color: COLOR.tenue, hideOverlap: true },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLOR.eje } },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: mapa.dias,
      axisLabel: { color: COLOR.tinta2, hideOverlap: true },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    visualMap: {
      type: 'continuous',
      min: minimo,
      max: maximo === minimo ? minimo + 1 : maximo,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 140,
      itemWidth: 10,
      text: [conUnidad(clave, maximo), conUnidad(clave, minimo)],
      textStyle: { color: COLOR.tinta2, fontSize: 11 },
      inRange: { color: RAMPA_CALOR },
      dimension: 2,
    },
    tooltip: {
      ...estiloTooltip,
      formatter: (p) => {
        const [hora, dia, promedio, n] = p.value;
        return `${esc(mapa.dias[dia])}, ${String(hora).padStart(2, '0')}:00<br>Promedio: <b>${esc(conUnidad(clave, promedio))}</b>${esAnormal(clave, promedio) ? ' ⚠️' : ''}<br>${n} lecturas`;
      },
    },
    series: [{ type: 'heatmap', data: mapa.celdas, itemStyle: { borderColor: COLOR.superficie, borderWidth: 2, borderRadius: 2 } }],
  }, mapa.celdas.length === 0, `Sin lecturas de ${etiquetaVar(clave)} en este rango`);
}

function pintarHistograma() {
  const l = estadoApp.lecturas;
  if (!l) return;
  const select = $('histograma-variable');
  // Por defecto turbidez o pH, las variables que pide el diseño.
  const preferidas = ['turbidez', 'ph'].filter((c) => l.histogramas[c]?.length);
  llenarSelector(select, preferidas.length ? preferidas : Object.keys(l.histogramas).filter((c) => l.histogramas[c].length));
  const clave = select.value;
  const bins = l.histogramas[clave] ?? [];
  const unidad = variable(clave)?.unidad;

  dibujar('g-histograma', {
    grid: { left: 8, right: 16, top: 12, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category',
      name: unidad || etiquetaVar(clave),
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: COLOR.tenue },
      data: bins.map((b) => String(Number(b.desde.toFixed(1)))),
      axisLabel: { color: COLOR.tenue, hideOverlap: true },
      axisLine: { lineStyle: { color: COLOR.eje } },
      axisTick: { show: false },
    },
    yAxis: { ...ejeValor, minInterval: 1 },
    tooltip: {
      ...estiloTooltip,
      formatter: (p) => {
        const b = bins[p.dataIndex];
        return `${b.desde} – ${b.hasta}${unidad ? ` ${esc(unidad)}` : ''}<br><b>${b.n}</b> lecturas${b.anormal ? '<br>⚠️ Fuera de límites' : ''}`;
      },
    },
    series: [{
      type: 'bar',
      barCategoryGap: 2,
      data: bins.map((b) => ({ value: b.n, itemStyle: { color: b.anormal ? COLOR.advertencia : COLOR.tenue, borderRadius: [3, 3, 0, 0] } })),
    }],
  }, bins.length === 0, `Sin lecturas de ${etiquetaVar(clave)} en este rango`);
}

function pintarAuditoria() {
  const a = estadoApp.auditoria;
  const vars = variables();
  $('auditoria-cabecera').innerHTML = `<tr><th>Fecha y hora</th><th>Nodo</th>${vars.map((v) => `<th class="num">${esc(v.etiqueta)}${v.unidad ? ` (${esc(v.unidad)})` : ''}</th>`).join('')}<th>Estado</th></tr>`;
  if (!a) return;
  $('tabla-auditoria').innerHTML = a.filas.map((f) => `<tr>
    <td>${esc(fechaHora(f.ts))}</td>
    <td>Nodo ${esc(f.nodo)}</td>
    ${vars.map((v) => {
      const anormal = f.anormales.includes(v.clave);
      const texto = f[v.clave] === null ? '—' : Number(f[v.clave]).toFixed(v.decimales);
      return `<td class="num ${anormal ? 'valor-anormal' : ''}">${anormal ? '⚠️ ' : ''}${esc(texto)}</td>`;
    }).join('')}
    <td>${f.estado === 'ANORMAL' ? '⚠️ ANORMAL' : '✅ NORMAL'}</td>
  </tr>`).join('') || `<tr><td class="vacia" colspan="${vars.length + 3}">Sin mediciones en este rango</td></tr>`;

  $('pagina-texto').textContent = `Página ${a.pagina} de ${a.paginas} · ${a.total} mediciones`;
  $('pagina-anterior').disabled = a.pagina <= 1;
  $('pagina-siguiente').disabled = a.pagina >= a.paginas;
}

function pintarHistorico() {
  pintarHeatmap();
  pintarHistograma();
  pintarAuditoria();
}

/* ---------- Pestaña Nodos ---------- */

function pintarNodos() {
  pintarTarjetasNodos('tarjetas-nodos-detalle');
  const t = estadoApp.telemetria;
  if (!t) return;
  $('nota-telemetria').textContent = `Sin comunicación: sin datos hace más de ${t.limiteSinComunicacionSeg} s (3 intervalos). Totales de todo el historial.`;
  const nodos = estadoApp.nodo === 'todos' ? t.nodos : t.nodos.filter((n) => String(n.nodo) === estadoApp.nodo);
  $('tabla-telemetria').innerHTML = nodos.map((n) => `<tr>
    <td><span class="muestra-nodo" style="display:inline-block;background:${colorNodo(n.nodo)}"></span> Nodo ${esc(n.nodo)}</td>
    <td>${esc(n.referencia ?? '—')}</td>
    <td>${esc((n.rol ?? '—').replace('_', ' '))}</td>
    <td>${pastillaConexion(n.conexion)}</td>
    <td>${esc(fechaHora(n.ultimoPaquete))}<span class="tenue"> · ${esc(hace(n.ultimoPaquete))}</span></td>
    <td class="num">${esc(n.mensajes)}</td>
    <td class="num">${esc(n.totalLecturas)}</td>
  </tr>`).join('') || '<tr><td class="vacia" colspan="7">Sin nodos registrados</td></tr>';
}

const PINTORES = {
  resumen: pintarResumen,
  variables: pintarVariables,
  alertas: pintarAlertas,
  historico: pintarHistorico,
  nodos: pintarNodos,
};

// Solo se dibuja la pestaña visible: ECharts no puede medir un contenedor oculto.
function pintarPestana() {
  if (estadoApp.estado) PINTORES[estadoApp.pestana]();
}

/* ---------- Datos ---------- */

function rangoActual() {
  const ahora = Date.now();
  switch (estadoApp.rango) {
    case '1h': return { desde: ahora - 3600e3, hasta: ahora };
    case '6h': return { desde: ahora - 6 * 3600e3, hasta: ahora };
    case '7d': return { desde: ahora - 7 * DIA_MS, hasta: ahora };
    case 'ultimos': {
      const hasta = estadoApp.estado?.ultimaMedicion ?? ahora;
      return { desde: hasta - DIA_MS, hasta };
    }
    case 'personalizado': return { desde: estadoApp.desdePersonal, hasta: estadoApp.hastaPersonal };
    default: return { desde: ahora - DIA_MS, hasta: ahora };
  }
}

function parametros(extra = {}) {
  const { desde, hasta } = rangoActual();
  const p = new URLSearchParams({ desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString(), ...extra });
  if (estadoApp.nodo !== 'todos') p.set('nodos', estadoApp.nodo);
  return p.toString();
}

async function pedir(ruta) {
  const respuesta = await fetch(ruta, { cache: 'no-store' });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || `Error ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
}

// Sin datos recientes, los rangos móviles quedarían vacíos. La primera vez se pasa
// al rango de la última medición y el aviso lo deja claro: no se oculta la antigüedad.
function ajustarRangoInicial() {
  const ultima = estadoApp.estado?.ultimaMedicion;
  if (estadoApp.rangoAuto || !ultima || estadoApp.rango !== '24h' || Date.now() - ultima < DIA_MS) return;
  estadoApp.rangoAuto = true;
  estadoApp.rango = 'ultimos';
  $('filtro-rango').value = 'ultimos';
  mostrarAviso();
}

function mostrarAviso() {
  const ultima = estadoApp.estado?.ultimaMedicion;
  const visible = estadoApp.rango === 'ultimos' && ultima && Date.now() - ultima >= DIA_MS;
  $('aviso').hidden = !visible;
  if (visible) {
    $('aviso').textContent = `No hay mediciones en las últimas 24 horas. Se muestran las 24 horas previas a la última medición (${fechaHora(ultima)}).`;
  }
}

function llenarSelectorNodos() {
  const select = $('filtro-nodo');
  const opciones = ['<option value="todos">Todos los nodos</option>']
    .concat((estadoApp.estado?.nodos ?? []).map((n) => `<option value="${esc(n.nodo)}">Nodo ${esc(n.nodo)}</option>`))
    .join('');
  if (select.dataset.opciones !== opciones) {
    select.innerHTML = opciones;
    select.dataset.opciones = opciones;
    select.value = estadoApp.nodo;
  }
}

async function actualizar({ manual = false } = {}) {
  const secuencia = ++estadoApp.secuencia;
  if (manual) document.querySelector('main').classList.add('actualizando');

  // Cada petición puede fallar sola: el resto de la interfaz sigue funcionando.
  let ok = true;
  try {
    const estado = await pedir('/api/estado');
    if (secuencia !== estadoApp.secuencia) return;
    estadoApp.estado = estado;
    ajustarRangoInicial();
    llenarSelectorNodos();
    pintarBanner();
    mostrarAviso();
  } catch (err) {
    ok = false;
    console.error('estado:', err.message);
  }

  const consulta = parametros();
  const peticiones = [
    pedir(`/api/lecturas?${consulta}`),
    pedir(`/api/alertas?${consulta}`),
    pedir('/api/nodos'),
    estadoApp.pestana === 'historico' ? pedir(`/api/auditoria?${parametros({ pagina: estadoApp.pagina })}`) : Promise.resolve(null),
  ];
  const [lecturas, alertas, telemetria, auditoria] = await Promise.allSettled(peticiones);
  if (secuencia !== estadoApp.secuencia) return;

  if (lecturas.status === 'fulfilled') estadoApp.lecturas = lecturas.value;
  if (alertas.status === 'fulfilled') estadoApp.alertas = alertas.value;
  if (telemetria.status === 'fulfilled') estadoApp.telemetria = telemetria.value;
  if (auditoria.status === 'fulfilled' && auditoria.value) estadoApp.auditoria = auditoria.value;

  for (const r of [lecturas, alertas, telemetria, auditoria]) {
    if (r.status === 'rejected') {
      // Un error 400 es un rango inválido, no una caída de la conexión.
      if (r.reason.estado === 400) mostrarErrorRango(r.reason.message);
      else ok = false;
      console.error(r.reason.message);
    }
  }

  pintarConexion(ok);
  try {
    pintarPestana();
  } catch (err) {
    console.error('Error al dibujar:', err);
  }
  document.querySelector('main').classList.remove('actualizando');
}

function mostrarErrorRango(mensaje) {
  $('aviso').hidden = false;
  $('aviso').textContent = `Rango no válido: ${mensaje}.`;
}

/* ---------- Eventos ---------- */

function cambiarPestana(nombre) {
  estadoApp.pestana = nombre;
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pestana === nombre)));
  document.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== `panel-${nombre}`; });
  try { history.replaceState(null, '', `#${nombre}`); } catch { /* sin historial disponible */ }
  pintarPestana();
  if (nombre === 'historico') actualizar();
}

function bogotaALocal(ts) {
  return new Date(ts + DESFASE_MS).toISOString().slice(0, 16);
}

function iniciarEventos() {
  document.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => cambiarPestana(b.dataset.pestana)));

  $('filtro-nodo').addEventListener('change', (e) => {
    estadoApp.nodo = e.target.value;
    estadoApp.pagina = 1;
    actualizar({ manual: true });
  });

  $('filtro-rango').addEventListener('change', (e) => {
    const valor = e.target.value;
    const esPersonal = valor === 'personalizado';
    $('rango-personalizado').hidden = !esPersonal;
    estadoApp.rangoAuto = true; // el usuario eligió: no volver a cambiarlo solo
    if (esPersonal) {
      const { desde, hasta } = rangoActual();
      $('filtro-desde').value = bogotaALocal(desde);
      $('filtro-hasta').value = bogotaALocal(hasta);
      return; // espera a "Aplicar"
    }
    estadoApp.rango = valor;
    estadoApp.pagina = 1;
    actualizar({ manual: true });
  });

  $('aplicar-rango').addEventListener('click', () => {
    // Los campos se interpretan como hora de Bogotá, sin importar la zona del navegador.
    const desde = Date.parse(`${$('filtro-desde').value}:00-05:00`);
    const hasta = Date.parse(`${$('filtro-hasta').value}:00-05:00`);
    if (Number.isNaN(desde) || Number.isNaN(hasta)) {
      mostrarErrorRango('complete las dos fechas');
      return;
    }
    if (desde > hasta) {
      mostrarErrorRango('la fecha inicial debe ser anterior a la final');
      return;
    }
    $('aviso').hidden = true;
    estadoApp.rango = 'personalizado';
    estadoApp.desdePersonal = desde;
    estadoApp.hastaPersonal = hasta;
    estadoApp.pagina = 1;
    actualizar({ manual: true });
  });

  $('refrescar').addEventListener('click', () => actualizar({ manual: true }));
  $('descargar-csv').addEventListener('click', (e) => { e.currentTarget.href = `/api/export.csv?${parametros()}`; });

  $('pagina-anterior').addEventListener('click', () => { estadoApp.pagina -= 1; actualizar(); });
  $('pagina-siguiente').addEventListener('click', () => { estadoApp.pagina += 1; actualizar(); });

  // Guardar la elección impide que el siguiente refresco la cambie.
  for (const [id, pintor] of [
    ['comparar-a', pintarComparativa],
    ['comparar-b', pintarComparativa],
    ['heatmap-variable', pintarHeatmap],
    ['histograma-variable', pintarHistograma],
  ]) {
    $(id).addEventListener('change', (e) => { e.target.dataset.elegido = e.target.value; pintor(); });
  }

  // Sin esto, la gráfica de una pestaña que no está visible no se redimensiona bien.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizar(); });
}

function iniciar() {
  iniciarEventos();
  const inicial = location.hash.slice(1);
  if (PINTORES[inicial]) cambiarPestana(inicial);
  actualizar();
  setInterval(() => { if (!document.hidden) actualizar(); }, REFRESCO_MS);
}

if (window.echarts) {
  iniciar();
} else {
  // Sin ECharts (CDN inaccesible) las tablas y tarjetas no pueden depender de él.
  $('banner-nivel').textContent = 'No se pudo cargar la librería de gráficas';
  $('banner-detalle').textContent = 'Revise la conexión a internet y recargue la página.';
}

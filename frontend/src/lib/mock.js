// Datos de demostración con la MISMA forma que la API. Se activan con ?demo=<escenario>
// y la interfaz muestra un aviso permanente: nunca deben confundirse con mediciones.
const VARIABLES = [
  { clave: 'ph', etiqueta: 'pH', unidad: '', escala: [0, 14], decimales: 2, limite: { min: 6.5, max: 8.5 } },
  { clave: 'temperatura', etiqueta: 'Temperatura', unidad: '°C', escala: [0, 50], decimales: 1, limite: { min: 24, max: 30 } },
  { clave: 'turbidez', etiqueta: 'Turbidez', unidad: 'NTU', escala: [0, 500], decimales: 1, limite: { max: 100 } },
  { clave: 'tds', etiqueta: 'TDS', unidad: 'ppm', escala: [0, 1000], decimales: 0, limite: { max: 600 } },
  { clave: 'nivel', etiqueta: 'Nivel', unidad: 'cm', escala: [0, 100], decimales: 1, limite: { min: 60, max: 95 } },
];
const CLAVES = VARIABLES.map((v) => v.clave);
const NODO_DE = { ph: 1, turbidez: 1, temperatura: 2, tds: 2, nivel: 2 };
const INTERVALO_MS = 30 * 1000;
const MINUTO = 60 * 1000;

// Valor objetivo de cada variable por escenario.
export const ESCENARIOS = {
  normal: { etiqueta: 'Normal', valores: { ph: 7.6, temperatura: 27, turbidez: 38, tds: 320, nivel: 78 } },
  advertencia: { etiqueta: 'Advertencia', valores: { ph: 7.4, temperatura: 27.4, turbidez: 164, tds: 340, nivel: 74 } },
  critica: { etiqueta: 'Crítica', valores: { ph: 7.2, temperatura: 34.3, turbidez: 211, tds: 410, nivel: 68 } },
  'sin-comunicacion': { etiqueta: 'Sin comunicación', valores: { ph: 7.5, temperatura: 21, turbidez: 211, tds: 24, nivel: null }, antiguedadMs: 9 * 24 * 3600 * 1000 },
  recuperacion: { etiqueta: 'Recuperación', valores: { ph: 7.4, temperatura: 27.4, turbidez: 164, tds: 340, nivel: 74 }, luegoDe: { ms: 14000, a: 'normal' } },
};

const inicio = Date.now();
const anormal = (v, x) => x !== null && ((v.limite.min !== undefined && x < v.limite.min) || (v.limite.max !== undefined && x > v.limite.max));
const nivelPorConteo = (n) => (n === 0 ? 'normal' : n === 1 ? 'advertencia' : 'critica');

function escenarioActivo(nombre) {
  const e = ESCENARIOS[nombre] ?? ESCENARIOS.critica;
  if (e.luegoDe && Date.now() - inicio > e.luegoDe.ms) return ESCENARIOS[e.luegoDe.a];
  return e;
}

// Oscilación determinista: el mismo instante siempre da el mismo valor.
function onda(ts, clave, valor, variable) {
  const fase = CLAVES.indexOf(clave) * 1.7;
  const amplitud = (variable.escala[1] - variable.escala[0]) * 0.012;
  return Number((valor + Math.sin(ts / 170000 + fase) * amplitud + Math.sin(ts / 41000 + fase) * amplitud * 0.4).toFixed(2));
}

function serie(clave, escenario, desde, hasta, paso = INTERVALO_MS) {
  const variable = VARIABLES.find((v) => v.clave === clave);
  const objetivo = escenario.valores[clave];
  if (objetivo === null) return [];
  const puntos = [];
  // Última medición del escenario: el rango pedido puede ya terminar antes que ella.
  const ultima = Math.floor((Date.now() - (escenario.antiguedadMs ?? 0)) / INTERVALO_MS) * INTERVALO_MS;
  const fin = Math.min(hasta, ultima);
  for (let ts = Math.max(desde, fin - 6 * 3600 * 1000); ts <= fin; ts += paso) {
    // Las primeras horas del rango se acercan al valor actual desde la zona normal.
    const avance = Math.min(1, (ts - (fin - 40 * MINUTO)) / (30 * MINUTO));
    const base = ESCENARIOS.normal.valores[clave];
    const valor = avance <= 0 ? base : base + (objetivo - base) * avance;
    puntos.push([ts, onda(ts, clave, valor, variable)]);
  }
  return puntos;
}

function crearEstado(nombre) {
  const escenario = escenarioActivo(nombre);
  const ahora = Date.now();
  const edad = escenario.antiguedadMs ?? 0;
  const ultima = Math.floor((ahora - edad) / INTERVALO_MS) * INTERVALO_MS;
  const enLinea = edad === 0;

  const nodos = [1, 2].map((nodo) => {
    const lecturas = {};
    const conocidas = {};
    const anormales = [];
    for (const v of VARIABLES) {
      lecturas[v.clave] = null;
      if (NODO_DE[v.clave] !== nodo) continue;
      const historia = serie(v.clave, escenario, ultima - 30 * INTERVALO_MS, ultima + edad);
      if (!historia.length) continue;
      const [ts, valor] = historia[historia.length - 1];
      const anterior = historia.length > 1 ? historia[historia.length - 2][1] : null;
      const variacion = anterior === null ? null : Number((valor - anterior).toFixed(3));
      const esAnormal = anormal(v, valor);
      if (esAnormal) anormales.push(v.clave);
      lecturas[v.clave] = {
        valor, anterior, variacion,
        variacionPct: anterior ? Number(((variacion / Math.abs(anterior)) * 100).toFixed(1)) : null,
        ts, vigente: true, anormal: esAnormal, historia,
      };
      conocidas[v.clave] = { valor, ts };
    }
    return {
      nodo,
      referencia: nodo === 1 ? 'esp32-a-maestra' : 'esp32-b-esclava',
      ultimaHora: ultima,
      conexion: enLinea ? 'en_linea' : 'sin_comunicacion',
      nivel: nivelPorConteo(anormales.length),
      anormales,
      lecturas,
      conocidas,
    };
  });
  const distintas = new Set(nodos.flatMap((n) => n.anormales));
  return {
    generadoEn: ahora,
    nivel: nivelPorConteo(distintas.size),
    ultimaMedicion: ultima,
    desactualizado: edad > 5 * MINUTO,
    minutosDesactualizado: 5,
    nodosReportando: enLinea ? 2 : 0,
    racha24h: nombre === 'normal',
    nodos,
    variables: VARIABLES,
    margenCerca: 0.1,
    intervaloSeg: 30,
  };
}

function medicionesRango(nombre, desde, hasta, nodos) {
  const escenario = escenarioActivo(nombre);
  const puntos = {};
  for (const c of CLAVES) {
    if (nodos && !nodos.includes(NODO_DE[c])) { puntos[c] = {}; continue; }
    const s = serie(c, escenario, desde, hasta);
    puntos[c] = s.length ? { [NODO_DE[c]]: s } : {};
  }
  return puntos;
}

function crearLecturas(nombre, consulta) {
  const desde = Date.parse(consulta.get('desde'));
  const hasta = Date.parse(consulta.get('hasta'));
  const nodos = consulta.get('nodos') ? consulta.get('nodos').split(',').map(Number) : null;
  const series = medicionesRango(nombre, desde, hasta, nodos);
  const todos = Object.values(series).flatMap((s) => Object.values(s)).flat();
  const estadisticas = {};
  const porcentajeAnormal = [];
  const mapasDeCalor = {};
  const histogramas = {};
  const lineaDeTiempo = {};

  for (const v of VARIABLES) {
    const puntos = Object.values(series[v.clave]).flat();
    const valores = puntos.map((p) => p[1]);
    const anormales = valores.filter((x) => anormal(v, x)).length;
    porcentajeAnormal.push({ clave: v.clave, total: valores.length, anormales, pct: valores.length ? Number(((anormales / valores.length) * 100).toFixed(1)) : 0 });
    estadisticas[v.clave] = {};
    for (const [n, s] of Object.entries(series[v.clave])) {
      const vs = s.map((p) => p[1]);
      estadisticas[v.clave][n] = { min: Math.min(...vs), max: Math.max(...vs), prom: Number((vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(3)), n: vs.length };
    }
    const celdas = new Map();
    for (const [ts, x] of puntos) {
      const local = new Date(ts - 5 * 3600 * 1000);
      const k = `${local.toISOString().slice(0, 10)}|${local.getUTCHours()}`;
      const c = celdas.get(k) ?? { suma: 0, n: 0 };
      c.suma += x; c.n += 1; celdas.set(k, c);
    }
    const dias = [...new Set([...celdas.keys()].map((k) => k.split('|')[0]))].sort();
    mapasDeCalor[v.clave] = { dias, celdas: [...celdas].map(([k, c]) => [Number(k.split('|')[1]), dias.indexOf(k.split('|')[0]), Number((c.suma / c.n).toFixed(2)), c.n]) };
    if (valores.length) {
      const min = Math.min(...valores); const max = Math.max(...valores);
      const ancho = (max - min) / 15 || 1;
      const bins = Array.from({ length: 15 }, (_, i) => ({ desde: Number((min + i * ancho).toFixed(2)), hasta: Number((min + (i + 1) * ancho).toFixed(2)), n: 0, anormal: anormal(v, min + (i + 0.5) * ancho) }));
      for (const x of valores) bins[Math.min(14, Math.floor((x - min) / ancho))].n += 1;
      histogramas[v.clave] = bins;
    } else histogramas[v.clave] = [];
  }

  for (const n of nodos ?? [1, 2]) {
    const propias = VARIABLES.filter((v) => NODO_DE[v.clave] === n && series[v.clave][n]);
    if (!propias.length) continue;
    const base = series[propias[0].clave][n];
    const segmentos = [];
    base.forEach(([ts], i) => {
      const cuenta = propias.filter((v) => anormal(v, series[v.clave][n][i]?.[1] ?? null)).length;
      const nivel = nivelPorConteo(cuenta);
      const ultimo = segmentos[segmentos.length - 1];
      if (ultimo && ultimo[2] === nivel) ultimo[1] = ts;
      else segmentos.push([ultimo ? ultimo[1] : ts, ts, nivel]);
    });
    lineaDeTiempo[n] = segmentos;
  }

  return {
    desde, hasta, totalMediciones: todos.length,
    primerDato: todos.length ? Math.min(...todos.map((p) => p[0])) : null,
    ultimoDato: todos.length ? Math.max(...todos.map((p) => p[0])) : null,
    baldeSeg: 0, series, lineaDeTiempo, porcentajeAnormal, estadisticas, mapasDeCalor, histogramas,
  };
}

function crearAlertas(nombre, consulta) {
  const desde = Date.parse(consulta.get('desde'));
  const hasta = Date.parse(consulta.get('hasta'));
  const nodos = consulta.get('nodos') ? consulta.get('nodos').split(',').map(Number) : null;
  const series = medicionesRango(nombre, desde, hasta, nodos);
  const alertas = [];
  const porVariable = {};
  const porNodo = {};
  const momentos = new Map();
  for (const v of VARIABLES) {
    for (const [n, s] of Object.entries(series[v.clave])) {
      for (const [ts, x] of s) {
        const m = momentos.get(ts) ?? new Set();
        if (anormal(v, x)) {
          m.add(v.clave);
          alertas.push({ ts, nodo: Number(n), variable: v.clave, valor: x });
          porVariable[v.clave] ??= {};
          porVariable[v.clave][n] = (porVariable[v.clave][n] ?? 0) + 1;
          porNodo[n] = (porNodo[n] ?? 0) + 1;
        }
        momentos.set(ts, m);
      }
    }
  }
  const distribucion = { normal: 0, advertencia: 0, critica: 0 };
  for (const m of momentos.values()) distribucion[nivelPorConteo(m.size)] += 1;
  const porSeveridad = { advertencia: 0, critica: 0 };
  for (const a of alertas) {
    a.severidad = nivelPorConteo(momentos.get(a.ts).size);
    porSeveridad[a.severidad] += 1;
  }
  alertas.sort((a, b) => b.ts - a.ts);
  return { total: alertas.length, recientes: alertas.slice(0, 200), porVariable, porNodo, porSeveridad, distribucion, eventos: [] };
}

function crearTelemetria(nombre) {
  const estado = crearEstado(nombre);
  return {
    limiteSinComunicacionSeg: 90,
    nodos: estado.nodos.map((n) => ({
      nodo: n.nodo, rol: n.nodo === 1 ? 'nodo_puente' : 'nodo_sensor', referencia: n.referencia,
      ultimoPaquete: n.ultimaHora, mensajes: 1280, totalLecturas: 2560, conexion: n.conexion,
    })),
  };
}

function crearAuditoria(nombre, consulta) {
  const desde = Date.parse(consulta.get('desde'));
  const hasta = Date.parse(consulta.get('hasta'));
  const nodos = consulta.get('nodos') ? consulta.get('nodos').split(',').map(Number) : null;
  const series = medicionesRango(nombre, desde, hasta, nodos);
  const filas = new Map();
  for (const v of VARIABLES) {
    for (const [n, s] of Object.entries(series[v.clave])) {
      for (const [ts, x] of s) {
        const k = `${ts}|${n}`;
        const f = filas.get(k) ?? { paqueteId: k, ts, nodo: Number(n), ph: null, turbidez: null, temperatura: null, tds: null, distancia: null, nivel: null, anormales: [], estado: 'NORMAL' };
        f[v.clave] = x;
        if (anormal(v, x)) { f.anormales.push(v.clave); f.estado = 'ANORMAL'; }
        filas.set(k, f);
      }
    }
  }
  const ordenadas = [...filas.values()].sort((a, b) => b.ts - a.ts);
  const pagina = Number(consulta.get('pagina')) || 1;
  const tam = 25;
  return { total: ordenadas.length, pagina, tam, paginas: Math.max(1, Math.ceil(ordenadas.length / tam)), filas: ordenadas.slice((pagina - 1) * tam, pagina * tam) };
}

// Responde como lo haría la API, según la ruta pedida.
export function responderDemo(nombre, ruta) {
  const url = new URL(ruta, 'http://local');
  switch (url.pathname) {
    case '/api/estado': return crearEstado(nombre);
    case '/api/lecturas': return crearLecturas(nombre, url.searchParams);
    case '/api/alertas': return crearAlertas(nombre, url.searchParams);
    case '/api/nodos': return crearTelemetria(nombre);
    case '/api/auditoria': return crearAuditoria(nombre, url.searchParams);
    default: throw new Error(`Ruta de demostración desconocida: ${url.pathname}`);
  }
}

export function csvDemo(nombre, consulta) {
  const a = crearAuditoria(nombre, new URLSearchParams(`${consulta}&pagina=1`));
  const filas = a.filas.map((f) => [new Date(f.ts).toISOString(), f.nodo, f.ph, f.turbidez, f.temperatura, f.nivel, f.tds, f.estado].map((x) => x ?? '').join(','));
  return `﻿DATOS DE DEMOSTRACION\r\nfecha,nodo,ph,turbidez_ntu,temp_c,nivel_cm,tds_ppm,estado\r\n${filas.join('\r\n')}\r\n`;
}

// Convierte las mediciones de un rango en los datos que pide cada gráfica.
const {
  DESFASE_BOGOTA_MS, INTERVALO_MEDICION_S, INTERVALOS_SIN_COMUNICACION,
  MAX_PUNTOS_SERIE, MAX_ALERTAS_RECIENTES,
} = require('../config');
const { CLAVES, esAnormal, reproducir, tieneDato } = require('./evaluacion');

const PASOS_HISTOGRAMA = 15;

// Series por variable y nodo. Si hay demasiados puntos se promedian por intervalos,
// y se inserta un null en los huecos para que la línea no una datos lejanos.
function construirSeries(mediciones, desde, hasta) {
  const crudas = {};
  for (const c of CLAVES) crudas[c] = {};
  let mayor = 0;
  for (const m of mediciones) {
    for (const c of CLAVES) {
      if (m[c] === null) continue;
      (crudas[c][m.nodo] ||= []).push([m.ts, m[c]]);
      mayor = Math.max(mayor, crudas[c][m.nodo].length);
    }
  }

  const baldeMs = mayor > MAX_PUNTOS_SERIE ? Math.ceil((hasta - desde) / MAX_PUNTOS_SERIE) : 0;
  const huecoMs = Math.max(INTERVALO_MEDICION_S * 10 * 1000, baldeMs * 3);

  const series = {};
  for (const c of CLAVES) {
    series[c] = {};
    for (const [nodo, puntos] of Object.entries(crudas[c])) {
      const base = baldeMs ? promediar(puntos, baldeMs) : puntos;
      const conHuecos = [];
      base.forEach((p, i) => {
        if (i > 0 && p[0] - base[i - 1][0] > huecoMs) conHuecos.push([base[i - 1][0] + 1, null]);
        conHuecos.push(p);
      });
      series[c][nodo] = conHuecos;
    }
  }
  return { series, baldeSeg: Math.round(baldeMs / 1000) };
}

function promediar(puntos, baldeMs) {
  const baldes = new Map();
  for (const [ts, valor] of puntos) {
    const inicio = Math.floor(ts / baldeMs) * baldeMs;
    const b = baldes.get(inicio) || { suma: 0, n: 0 };
    b.suma += valor;
    b.n += 1;
    baldes.set(inicio, b);
  }
  return [...baldes].map(([ts, b]) => [ts, Number((b.suma / b.n).toFixed(3))]);
}

// Segmentos [inicio, fin, nivel] por nodo. Un silencio largo corta el segmento.
function construirLineaDeTiempo(mediciones) {
  const maxSilencio = INTERVALO_MEDICION_S * INTERVALOS_SIN_COMUNICACION * 1000;
  const porNodo = {};
  reproducir(mediciones, ({ medicion: m, nivelNodo }) => {
    const segmentos = (porNodo[m.nodo] ||= []);
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && m.ts - ultimo[1] <= maxSilencio) {
      ultimo[1] = m.ts;
      if (ultimo[2] === nivelNodo) return;
      segmentos.push([m.ts, m.ts, nivelNodo]);
    } else {
      segmentos.push([m.ts, m.ts, nivelNodo]);
    }
  });
  return porNodo;
}

// Mínimo, máximo y promedio del rango por variable y nodo, para el detalle.
function construirEstadisticas(mediciones) {
  const stats = {};
  for (const m of mediciones) {
    for (const c of CLAVES) {
      if (m[c] === null) continue;
      stats[c] ||= {};
      const s = (stats[c][m.nodo] ||= { min: m[c], max: m[c], suma: 0, n: 0 });
      s.min = Math.min(s.min, m[c]);
      s.max = Math.max(s.max, m[c]);
      s.suma += m[c];
      s.n += 1;
    }
  }
  for (const porNodo of Object.values(stats)) {
    for (const s of Object.values(porNodo)) {
      s.prom = Number((s.suma / s.n).toFixed(3));
      delete s.suma;
    }
  }
  return stats;
}

function porcentajeAnormal(mediciones) {
  return CLAVES.map((clave) => {
    const validas = mediciones.filter((m) => m[clave] !== null);
    const anormales = validas.filter((m) => esAnormal(clave, m[clave])).length;
    return {
      clave,
      total: validas.length,
      anormales,
      pct: validas.length ? Number(((anormales / validas.length) * 100).toFixed(1)) : 0,
    };
  });
}

// Promedio por hora del día (eje X) y día (eje Y), en hora de Bogotá.
function construirMapasDeCalor(mediciones) {
  const mapas = {};
  for (const clave of CLAVES) {
    const celdas = new Map();
    for (const m of mediciones) {
      if (m[clave] === null) continue;
      const local = new Date(m.ts + DESFASE_BOGOTA_MS);
      const k = `${local.toISOString().slice(0, 10)}|${local.getUTCHours()}`;
      const c = celdas.get(k) || { suma: 0, n: 0 };
      c.suma += m[clave];
      c.n += 1;
      celdas.set(k, c);
    }
    const dias = [...new Set([...celdas.keys()].map((k) => k.split('|')[0]))].sort();
    mapas[clave] = {
      dias,
      celdas: [...celdas].map(([k, c]) => {
        const [dia, hora] = k.split('|');
        return [Number(hora), dias.indexOf(dia), Number((c.suma / c.n).toFixed(2)), c.n];
      }),
    };
  }
  return mapas;
}

function construirHistogramas(mediciones) {
  const histogramas = {};
  for (const clave of CLAVES) {
    const valores = mediciones.map((m) => m[clave]).filter((v) => v !== null);
    if (!valores.length) { histogramas[clave] = []; continue; }
    // reduce y no Math.min(...valores): el spread desborda la pila con muchas filas.
    const min = valores.reduce((a, b) => Math.min(a, b));
    const max = valores.reduce((a, b) => Math.max(a, b));
    const ancho = (max - min) / PASOS_HISTOGRAMA || 1;
    const pasos = max === min ? 1 : PASOS_HISTOGRAMA;
    const bins = Array.from({ length: pasos }, (_, i) => {
      const desde = min + i * ancho;
      return { desde: Number(desde.toFixed(2)), hasta: Number((desde + ancho).toFixed(2)), n: 0 };
    });
    for (const v of valores) bins[Math.min(pasos - 1, Math.floor((v - min) / ancho))].n += 1;
    for (const b of bins) b.anormal = esAnormal(clave, (b.desde + b.hasta) / 2);
    histogramas[clave] = bins;
  }
  return histogramas;
}

function analizarLecturas(mediciones, desde, hasta) {
  const { series, baldeSeg } = construirSeries(mediciones, desde, hasta);
  const conDato = mediciones.filter(tieneDato);
  return {
    desde,
    hasta,
    primerDato: conDato.length ? conDato[0].ts : null,
    ultimoDato: conDato.length ? conDato[conDato.length - 1].ts : null,
    totalMediciones: mediciones.length,
    baldeSeg,
    series,
    lineaDeTiempo: construirLineaDeTiempo(mediciones),
    porcentajeAnormal: porcentajeAnormal(mediciones),
    estadisticas: construirEstadisticas(mediciones),
    mapasDeCalor: construirMapasDeCalor(mediciones),
    histogramas: construirHistogramas(mediciones),
  };
}

// Cada valor fuera de límites es una alerta. Su severidad es el nivel general del
// sistema en ese instante: crítica si había otra variable anormal al mismo tiempo.
function analizarAlertas(mediciones) {
  const alertas = [];
  const distribucion = { normal: 0, advertencia: 0, critica: 0 };
  const porVariable = {};
  const porNodo = {};
  const porSeveridad = { advertencia: 0, critica: 0 };

  reproducir(mediciones, ({ medicion: m, nivelGeneral }) => {
    distribucion[nivelGeneral] += 1;
    for (const clave of CLAVES) {
      if (!esAnormal(clave, m[clave])) continue;
      alertas.push({ ts: m.ts, nodo: m.nodo, variable: clave, valor: m[clave], severidad: nivelGeneral });
      porVariable[clave] ||= {};
      porVariable[clave][m.nodo] = (porVariable[clave][m.nodo] || 0) + 1;
      porNodo[m.nodo] = (porNodo[m.nodo] || 0) + 1;
      porSeveridad[nivelGeneral] += 1;
    }
  });

  return {
    total: alertas.length,
    recientes: alertas.slice(-MAX_ALERTAS_RECIENTES).reverse(),
    porVariable,
    porNodo,
    porSeveridad,
    distribucion,
  };
}

module.exports = { analizarLecturas, analizarAlertas };

// GET /api/estado: estado general y por nodo, con la última lectura y la hora.
const express = require('express');
const SQL = require('../lib/sql');
const { consultar } = require('../lib/db');
const { cachear } = require('../lib/cache');
const { obtenerMediciones } = require('../lib/datos');
const {
  CLAVES, VIGENCIA_MS, limpiar, esAnormal, nivelPorConteo, anormalesDe, tieneDato,
} = require('../lib/evaluacion');
const {
  ALTURA_SENSOR_CM, LIMITES, VARIABLES, INTERVALO_MEDICION_S, INTERVALOS_SIN_COMUNICACION,
  MINUTOS_DESACTUALIZADO, MARGEN_CERCA,
} = require('../config');

const router = express.Router();

const PAQUETES_A_REVISAR = 5000;
const MEDICIONES_POR_NODO = 40;
const PUNTOS_SPARKLINE = 30;
const DIA_MS = 24 * 3600 * 1000;

// Resume un nodo a partir de sus mediciones recientes en orden cronológico.
function resumirNodo(nodo, referencia, mediciones, conocidas, ahora) {
  const ultimaHora = mediciones.length ? mediciones[mediciones.length - 1].ts : null;
  const lecturas = {};
  for (const clave of CLAVES) {
    const conValor = mediciones.filter((m) => m[clave] !== null);
    const ultima = conValor[conValor.length - 1];
    const previa = conValor[conValor.length - 2];
    if (!ultima) { lecturas[clave] = null; continue; }
    // La vigencia se mide contra el último mensaje del nodo: si ese sensor dejó
    // de reportar, su valor viejo se muestra como "sin dato" y no como alerta.
    const vigente = ultimaHora - ultima.ts <= VIGENCIA_MS;
    const variacion = previa ? Number((ultima[clave] - previa[clave]).toFixed(3)) : null;
    lecturas[clave] = {
      valor: ultima[clave],
      anterior: previa ? previa[clave] : null,
      variacion,
      variacionPct: previa && previa[clave] !== 0 ? Number(((variacion / Math.abs(previa[clave])) * 100).toFixed(1)) : null,
      ts: ultima.ts,
      vigente,
      anormal: vigente && esAnormal(clave, ultima[clave]),
      historia: conValor.slice(-PUNTOS_SPARKLINE).map((m) => [m.ts, m[clave]]),
    };
  }

  const anormales = CLAVES.filter((c) => lecturas[c]?.anormal);
  const limiteSilencio = INTERVALO_MEDICION_S * INTERVALOS_SIN_COMUNICACION * 1000;
  return {
    nodo,
    referencia,
    ultimaHora,
    conexion: ultimaHora !== null && ahora - ultimaHora <= limiteSilencio ? 'en_linea' : 'sin_comunicacion',
    nivel: ultimaHora === null ? 'sin_datos' : nivelPorConteo(anormales.length),
    anormales,
    lecturas,
    conocidas,
  };
}

// Convierte la fila de ULTIMA_CONOCIDA en { clave: { valor, ts } }.
function leerConocidas(fila) {
  if (!fila) return {};
  const salida = {};
  for (const clave of CLAVES) {
    const crudo = clave === 'nivel' ? fila.distancia : fila[clave];
    const ts = fila[`${clave}_ts`];
    if (crudo === null || crudo === undefined || !ts) continue;
    salida[clave] = {
      valor: clave === 'nivel' ? ALTURA_SENSOR_CM - crudo : crudo,
      ts: new Date(ts).getTime(),
    };
  }
  return salida;
}

// Racha de 24 h sin alertas. Solo se calcula con datos en vivo y estado normal, y
// exige datos de todo el periodo: un nodo recién encendido no ha ganado la racha.
async function calcularRacha(ahora) {
  const redondeado = Math.floor(ahora / 10000) * 10000;
  const mediciones = (await obtenerMediciones({ desde: redondeado - DIA_MS, hasta: redondeado }, null)).filter(tieneDato);
  if (!mediciones.length || mediciones[0].ts > ahora - 23 * 3600 * 1000) return false;
  return mediciones.every((m) => anormalesDe(m).length === 0);
}

async function calcularEstado() {
  const [filas, dispositivos, ultimas] = await Promise.all([
    consultar(SQL.ULTIMAS_POR_NODO, [PAQUETES_A_REVISAR, MEDICIONES_POR_NODO]),
    consultar(SQL.DISPOSITIVOS),
    consultar(SQL.ULTIMA_CONOCIDA, [PAQUETES_A_REVISAR]),
  ]);
  const mediciones = filas.map(limpiar);
  const ahora = Date.now();

  // Se unen los nodos registrados con los que aparecen en los datos.
  const referencias = new Map(dispositivos.map((d) => [d.nodo, d.referencia]));
  for (const m of mediciones) if (!referencias.has(m.nodo)) referencias.set(m.nodo, null);
  const conocidas = new Map(ultimas.map((f) => [f.nodo, leerConocidas(f)]));

  const nodos = [...referencias.keys()].sort((a, b) => a - b).map((nodo) => resumirNodo(
    nodo,
    referencias.get(nodo),
    mediciones.filter((m) => m.nodo === nodo && CLAVES.some((c) => m[c] !== null)),
    conocidas.get(nodo) ?? {},
    ahora,
  ));

  // Nivel general: variables anormales distintas sumando todos los nodos.
  const variablesAnormales = new Set(nodos.flatMap((n) => n.anormales));
  const horas = nodos.map((n) => n.ultimaHora).filter((h) => h !== null);
  const ultimaMedicion = horas.length ? Math.max(...horas) : null;
  const nivel = horas.length ? nivelPorConteo(variablesAnormales.size) : 'sin_datos';
  const desactualizado = ultimaMedicion === null || ahora - ultimaMedicion > MINUTOS_DESACTUALIZADO * 60 * 1000;

  return {
    generadoEn: ahora,
    nivel,
    ultimaMedicion,
    desactualizado,
    minutosDesactualizado: MINUTOS_DESACTUALIZADO,
    nodosReportando: nodos.filter((n) => n.conexion === 'en_linea').length,
    racha24h: nivel === 'normal' && !desactualizado ? await calcularRacha(ahora) : false,
    nodos,
    variables: VARIABLES.map((v) => ({ ...v, limite: LIMITES[v.clave] || {} })),
    margenCerca: MARGEN_CERCA,
    intervaloSeg: INTERVALO_MEDICION_S,
  };
}

router.get('/estado', async (req, res, next) => {
  try {
    res.json(await cachear('estado', calcularEstado));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

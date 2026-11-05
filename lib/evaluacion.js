// Reglas de negocio: limpieza de mensajes y cálculo de los tres niveles de alerta.
const {
  ALTURA_SENSOR_CM, LIMITES, VARIABLES, INTERVALO_MEDICION_S, INTERVALOS_VIGENCIA,
} = require('../config');

const CLAVES = VARIABLES.map((v) => v.clave);
const VIGENCIA_MS = INTERVALO_MEDICION_S * INTERVALOS_VIGENCIA * 1000;

// Convierte una fila de SQL en una medición. Un campo faltante queda en null,
// que significa "sin dato" y nunca cuenta como anormal.
function limpiar(fila) {
  const crudos = [fila.ph, fila.turbidez_ntu, fila.temp_c, fila.distancia_cm, fila.tds_ppm];
  const presentes = crudos.filter((v) => v !== null && v !== undefined);
  // Igual que el flujo de n8n: un mensaje con todo en cero es un nodo sin lectura.
  const todoEnCero = presentes.length > 0 && presentes.every((v) => v === 0);
  const leer = (v) => (todoEnCero || v === undefined ? null : v);

  const distancia = leer(fila.distancia_cm);
  return {
    paqueteId: fila.paquete_id,
    ts: new Date(fila.recibido_en).getTime(),
    nodo: fila.nodo,
    ph: leer(fila.ph),
    turbidez: leer(fila.turbidez_ntu),
    temperatura: leer(fila.temp_c),
    tds: leer(fila.tds_ppm),
    distancia,
    // Una distancia negativa es una falla del HC-SR04: se trata como sin dato.
    nivel: distancia === null || distancia < 0 ? null : ALTURA_SENSOR_CM - distancia,
  };
}

function esAnormal(clave, valor) {
  if (valor === null || valor === undefined) return false;
  const limite = LIMITES[clave];
  if (!limite) return false;
  return (limite.min !== undefined && valor < limite.min)
    || (limite.max !== undefined && valor > limite.max);
}

// Regla de la rúbrica: 0 variables anormales = normal, 1 = advertencia, 2 o más = crítica.
function nivelPorConteo(n) {
  if (n === 0) return 'normal';
  return n === 1 ? 'advertencia' : 'critica';
}

const anormalesDe = (m) => CLAVES.filter((c) => esAnormal(c, m[c]));
const tieneDato = (m) => CLAVES.some((c) => m[c] !== null);

// Recorre las mediciones en orden y calcula el estado en cada instante.
// Los nodos envían por separado, así que "al mismo tiempo" significa: considerando
// la última lectura todavía vigente de cada variable en cada nodo. Una variable
// anormal en dos nodos cuenta como una sola, según la definición de advertencia.
function reproducir(mediciones, alPaso) {
  const vigentes = new Map();
  for (const m of mediciones) {
    if (!tieneDato(m)) continue;
    if (!vigentes.has(m.nodo)) vigentes.set(m.nodo, {});
    const delNodo = vigentes.get(m.nodo);
    for (const c of CLAVES) if (m[c] !== null) delNodo[c] = { valor: m[c], ts: m.ts };

    const general = new Set();
    const propias = new Set();
    for (const [nodo, lecturas] of vigentes) {
      for (const [c, l] of Object.entries(lecturas)) {
        if (m.ts - l.ts > VIGENCIA_MS || !esAnormal(c, l.valor)) continue;
        general.add(c);
        if (nodo === m.nodo) propias.add(c);
      }
    }
    alPaso({
      medicion: m,
      nivelNodo: nivelPorConteo(propias.size),
      nivelGeneral: nivelPorConteo(general.size),
    });
  }
}

module.exports = {
  CLAVES, VIGENCIA_MS, limpiar, esAnormal, nivelPorConteo, anormalesDe, tieneDato, reproducir,
};

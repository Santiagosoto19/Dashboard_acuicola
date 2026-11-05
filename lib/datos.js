// Lectura de datos compartida por las rutas y validación de los parámetros de la URL.
const SQL = require('./sql');
const { consultar } = require('./db');
const { cachear } = require('./cache');
const { limpiar } = require('./evaluacion');
const { RANGO_MAX_DIAS } = require('../config');

// Error causado por la petición del cliente: se responde con 400.
class ErrorParametro extends Error {}

const DIEZ_S = 10 * 1000;
const DIA_MS = 24 * 3600 * 1000;

function leerFecha(texto, nombre) {
  const ms = new Date(texto).getTime();
  if (Number.isNaN(ms)) throw new ErrorParametro(`Fecha inválida en "${nombre}"`);
  return ms;
}

// Por defecto, las últimas 24 h. Se alinea a 10 s para que los rangos móviles
// reutilicen la caché en vez de generar una clave nueva en cada petición.
function leerRango(query) {
  const hastaBruto = query.hasta ? leerFecha(query.hasta, 'hasta') : Date.now();
  const desdeBruto = query.desde ? leerFecha(query.desde, 'desde') : hastaBruto - DIA_MS;
  if (desdeBruto > hastaBruto) throw new ErrorParametro('"desde" debe ser anterior a "hasta"');
  if (hastaBruto - desdeBruto > RANGO_MAX_DIAS * DIA_MS) {
    throw new ErrorParametro(`El rango máximo es de ${RANGO_MAX_DIAS} días`);
  }
  return {
    desde: Math.floor(desdeBruto / DIEZ_S) * DIEZ_S,
    hasta: Math.ceil(hastaBruto / DIEZ_S) * DIEZ_S,
  };
}

// "1,2" => [1, 2]. Vacío o "todos" => null, que en SQL significa todos los nodos.
function leerNodos(texto) {
  if (!texto || texto === 'todos') return null;
  const nodos = String(texto).split(',').map((n) => n.trim());
  if (!nodos.every((n) => /^[0-9]{1,6}$/.test(n))) throw new ErrorParametro('Parámetro "nodos" inválido');
  return nodos.map(Number).sort((a, b) => a - b);
}

function obtenerMediciones({ desde, hasta }, nodos) {
  return cachear(`mediciones:${desde}:${hasta}:${nodos ?? 'todos'}`, async () => {
    const filas = await consultar(SQL.MEDICIONES_RANGO, [new Date(desde), new Date(hasta), nodos]);
    return filas.map(limpiar);
  });
}

module.exports = { ErrorParametro, leerRango, leerNodos, obtenerMediciones };

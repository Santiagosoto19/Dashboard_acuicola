// Caché en memoria con TTL. Si llegan peticiones iguales mientras una consulta
// está en curso, todas comparten esa misma promesa.
const { CACHE_TTL_MS } = require('../config');

const entradas = new Map();

function cachear(clave, producir) {
  const ahora = Date.now();
  const existente = entradas.get(clave);
  if (existente && existente.vence > ahora) return existente.promesa;

  // Limpieza de entradas vencidas: los rangos móviles generan claves nuevas.
  for (const [k, e] of entradas) if (e.vence <= ahora) entradas.delete(k);

  const promesa = Promise.resolve().then(producir);
  entradas.set(clave, { promesa, vence: ahora + CACHE_TTL_MS });
  // Los errores no se guardan: la siguiente petición vuelve a intentar.
  promesa.catch(() => entradas.delete(clave));
  return promesa;
}

module.exports = { cachear };

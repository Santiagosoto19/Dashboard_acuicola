// GET /api/nodos: telemetría de cada nodo (último paquete, totales y conexión).
const express = require('express');
const SQL = require('../lib/sql');
const { consultar } = require('../lib/db');
const { cachear } = require('../lib/cache');
const { INTERVALO_MEDICION_S, INTERVALOS_SIN_COMUNICACION } = require('../config');

const router = express.Router();

async function calcularTelemetria() {
  const [telemetria, dispositivos] = await Promise.all([
    consultar(SQL.TELEMETRIA),
    consultar(SQL.DISPOSITIVOS),
  ]);
  const ahora = Date.now();
  const limiteMs = INTERVALO_MEDICION_S * INTERVALOS_SIN_COMUNICACION * 1000;
  const porNodo = new Map(telemetria.map((t) => [t.nodo, t]));
  const registrados = new Map(dispositivos.map((d) => [d.nodo, d]));
  const ids = [...new Set([...porNodo.keys(), ...registrados.keys()])].sort((a, b) => a - b);

  return {
    limiteSinComunicacionSeg: limiteMs / 1000,
    nodos: ids.map((nodo) => {
      const t = porNodo.get(nodo);
      const d = registrados.get(nodo);
      const ultimoPaquete = t ? new Date(t.ultimo_paquete).getTime() : null;
      return {
        nodo,
        rol: d?.rol ?? null,
        referencia: d?.referencia ?? null,
        ultimoPaquete,
        mensajes: t?.mensajes ?? 0,
        totalLecturas: t?.lecturas ?? 0,
        conexion: ultimoPaquete !== null && ahora - ultimoPaquete <= limiteMs ? 'en_linea' : 'sin_comunicacion',
      };
    }),
  };
}

router.get('/nodos', async (req, res, next) => {
  try {
    res.json(await cachear('nodos', calcularTelemetria));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

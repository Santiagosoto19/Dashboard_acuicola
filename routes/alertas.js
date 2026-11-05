// GET /api/alertas?desde=&hasta=&nodos=: alertas recientes y conteos por variable,
// nodo y severidad.
//
// Los conteos se calculan desde las mediciones y no desde la tabla "eventos", porque
// esa tabla guarda una sola fila por (variable, tipo), no registra el nodo y no
// incluye turbidez. Sus filas se devuelven aparte, en "eventos", tal como están.
const express = require('express');
const SQL = require('../lib/sql');
const { consultar } = require('../lib/db');
const { cachear } = require('../lib/cache');
const { analizarAlertas } = require('../lib/analisis');
const { leerRango, leerNodos, obtenerMediciones } = require('../lib/datos');

const router = express.Router();

router.get('/alertas', async (req, res, next) => {
  try {
    const rango = leerRango(req.query);
    const nodos = leerNodos(req.query.nodos);
    const clave = `alertas:${rango.desde}:${rango.hasta}:${nodos ?? 'todos'}`;
    res.json(await cachear(clave, async () => {
      const [mediciones, eventos] = await Promise.all([
        obtenerMediciones(rango, nodos),
        consultar(SQL.EVENTOS, [new Date(rango.desde), new Date(rango.hasta)]),
      ]);
      return { ...analizarAlertas(mediciones), eventos };
    }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

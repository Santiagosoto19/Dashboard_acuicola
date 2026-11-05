// GET /api/lecturas?desde=&hasta=&nodos=: serie temporal por variable y nodo,
// más los agregados de las demás gráficas (estado, heatmap, histograma, % anormal).
// GET /api/auditoria?desde=&hasta=&nodos=&pagina=&tam=: cada medición con su estado.
const express = require('express');
const SQL = require('../lib/sql');
const { consultar } = require('../lib/db');
const { cachear } = require('../lib/cache');
const { limpiar, anormalesDe } = require('../lib/evaluacion');
const { analizarLecturas } = require('../lib/analisis');
const { leerRango, leerNodos, obtenerMediciones } = require('../lib/datos');

const router = express.Router();

const TAM_POR_DEFECTO = 25;
const TAM_MAXIMO = 100;

router.get('/lecturas', async (req, res, next) => {
  try {
    const rango = leerRango(req.query);
    const nodos = leerNodos(req.query.nodos);
    const clave = `lecturas:${rango.desde}:${rango.hasta}:${nodos ?? 'todos'}`;
    res.json(await cachear(clave, async () => {
      const mediciones = await obtenerMediciones(rango, nodos);
      return analizarLecturas(mediciones, rango.desde, rango.hasta);
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/auditoria', async (req, res, next) => {
  try {
    const { desde, hasta } = leerRango(req.query);
    const nodos = leerNodos(req.query.nodos);
    const tam = Math.min(TAM_MAXIMO, Math.max(1, Number.parseInt(req.query.tam, 10) || TAM_POR_DEFECTO));
    const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);

    const clave = `auditoria:${desde}:${hasta}:${nodos ?? 'todos'}:${tam}:${pagina}`;
    res.json(await cachear(clave, async () => {
      const parametros = [new Date(desde), new Date(hasta), nodos];
      const [totales, filas] = await Promise.all([
        consultar(SQL.AUDITORIA_TOTAL, parametros),
        consultar(SQL.AUDITORIA_PAGINA, [...parametros, tam, (pagina - 1) * tam]),
      ]);
      const total = totales[0].total;
      return {
        total,
        pagina,
        tam,
        paginas: Math.max(1, Math.ceil(total / tam)),
        filas: filas.map((fila) => {
          const m = limpiar(fila);
          const anormales = anormalesDe(m);
          return { ...m, anormales, estado: anormales.length ? 'ANORMAL' : 'NORMAL' };
        }),
      };
    }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

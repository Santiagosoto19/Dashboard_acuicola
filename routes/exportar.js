// GET /api/export.csv?desde=&hasta=&nodos=: descarga las mediciones del rango.
const express = require('express');
const { anormalesDe } = require('../lib/evaluacion');
const { leerRango, leerNodos, obtenerMediciones } = require('../lib/datos');
const { ZONA_HORARIA } = require('../config');

const router = express.Router();

// El formato sv-SE produce "AAAA-MM-DD HH:mm:ss", que Excel reconoce como fecha.
const formatoFecha = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA_HORARIA,
  dateStyle: 'short',
  timeStyle: 'medium',
});

const COLUMNAS = [
  'fecha_hora_bogota', 'paquete_id', 'nodo', 'ph', 'turbidez_ntu', 'temp_c',
  'distancia_cm', 'nivel_cm', 'tds_ppm', 'estado', 'variables_anormales',
];

const celda = (valor) => (valor === null || valor === undefined ? '' : String(valor));

router.get('/export.csv', async (req, res, next) => {
  try {
    const rango = leerRango(req.query);
    const nodos = leerNodos(req.query.nodos);
    const mediciones = await obtenerMediciones(rango, nodos);

    const filas = mediciones.map((m) => {
      const anormales = anormalesDe(m);
      return [
        formatoFecha.format(m.ts), m.paqueteId, m.nodo, m.ph, m.turbidez, m.temperatura,
        m.distancia, m.nivel, m.tds, anormales.length ? 'ANORMAL' : 'NORMAL', anormales.join('|'),
      ].map(celda).join(',');
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mediciones_acuicola.csv"');
    // El BOM hace que Excel interprete bien el UTF-8.
    res.send(`﻿${[COLUMNAS.join(','), ...filas].join('\r\n')}\r\n`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

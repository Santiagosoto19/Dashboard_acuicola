// Pruebas de la regla de la rúbrica y de la limpieza de datos (sin base de datos).
const test = require('node:test');
const assert = require('node:assert');
const { limpiar, esAnormal, reproducir } = require('../lib/evaluacion');

const T0 = Date.parse('2026-10-27T14:00:00Z');
const fila = (segundos, nodo, campos) => ({
  paquete_id: '1', recibido_en: new Date(T0 + segundos * 1000), nodo, ...campos,
});

function nivelesFinales(filas) {
  let ultimo = null;
  reproducir(filas.map(limpiar), (paso) => { ultimo = paso; });
  return ultimo;
}

test('un campo faltante o nulo es sin dato, no anormal', () => {
  const m = limpiar(fila(0, 1, { ph: null, turbidez_ntu: 10 }));
  assert.strictEqual(m.ph, null);
  assert.strictEqual(m.temperatura, null);
  assert.strictEqual(esAnormal('ph', m.ph), false);
});

test('el nivel es 100 - distancia, y una distancia negativa es sin dato', () => {
  assert.strictEqual(limpiar(fila(0, 2, { distancia_cm: 35 })).nivel, 65);
  assert.strictEqual(limpiar(fila(0, 2, { distancia_cm: -1 })).nivel, null);
});

test('un mensaje con todo en cero es sin dato; un solo cero es un valor', () => {
  assert.strictEqual(limpiar(fila(0, 2, { temp_c: 0, tds_ppm: 0 })).temperatura, null);
  assert.strictEqual(limpiar(fila(0, 2, { temp_c: 29, tds_ppm: 0 })).tds, 0);
});

test('todas las variables dentro de límites: normal', () => {
  const p = nivelesFinales([fila(0, 1, { ph: 7, turbidez_ntu: 10 }), fila(1, 2, { temp_c: 30, tds_ppm: 100 })]);
  assert.strictEqual(p.nivelGeneral, 'normal');
});

test('una variable anormal: advertencia', () => {
  const p = nivelesFinales([fila(0, 1, { ph: 7, turbidez_ntu: 200 })]);
  assert.strictEqual(p.nivelGeneral, 'advertencia');
});

test('la misma variable anormal en dos nodos sigue siendo advertencia', () => {
  const p = nivelesFinales([fila(0, 1, { turbidez_ntu: 200 }), fila(1, 2, { turbidez_ntu: 300 })]);
  assert.strictEqual(p.nivelGeneral, 'advertencia');
});

test('dos variables anormales en nodos distintos: crítica general, advertencia por nodo', () => {
  const p = nivelesFinales([fila(0, 1, { turbidez_ntu: 200 }), fila(1, 2, { temp_c: 21 })]);
  assert.strictEqual(p.nivelGeneral, 'critica');
  assert.strictEqual(p.nivelNodo, 'advertencia');
});

test('una lectura anormal vencida deja de contar', () => {
  const p = nivelesFinales([fila(0, 1, { ph: 11, turbidez_ntu: 10 }), fila(3600, 1, { turbidez_ntu: 10 })]);
  assert.strictEqual(p.nivelGeneral, 'normal');
});

test('los valores justo en el límite son normales', () => {
  assert.strictEqual(esAnormal('ph', 6.5), false);
  assert.strictEqual(esAnormal('ph', 8.5), false);
  assert.strictEqual(esAnormal('ph', 8.6), true);
  assert.strictEqual(esAnormal('temperatura', 24), false);
  assert.strictEqual(esAnormal('temperatura', 23.9), true);
  assert.strictEqual(esAnormal('temperatura', 30), false);
  assert.strictEqual(esAnormal('temperatura', 30.1), true);
  assert.strictEqual(esAnormal('tds', 600), false);
  assert.strictEqual(esAnormal('tds', 600.1), true);
});

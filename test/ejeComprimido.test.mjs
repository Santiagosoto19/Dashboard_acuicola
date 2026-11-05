// El eje recorta los días sin datos, pero las fechas que muestra deben ser las reales.
import test from 'node:test';
import assert from 'node:assert';
import { crearEjeComprimido } from '../frontend/src/lib/ejeComprimido.js';

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;
const T0 = Date.UTC(2026, 9, 10, 14);
const lecturasCon = (...puntos) => ({ series: { ph: { 1: puntos.map((ts) => [ts, 7]) } } });

test('sin huecos largos el eje conserva la escala real', () => {
  const eje = crearEjeComprimido(lecturasCon(T0, T0 + 30 * MIN, T0 + 60 * MIN));
  assert.strictEqual(eje.huecos.length, 0);
  assert.strictEqual(eje.etiqueta, null);
  assert.strictEqual(eje.deEje(eje.aEje(T0 + 45 * MIN)), T0 + 45 * MIN);
});

test('un hueco de días queda recortado y se informa su duración', () => {
  const fin = T0 + 14 * DIA + 40 * MIN;
  const eje = crearEjeComprimido(lecturasCon(T0, T0 + 40 * MIN, T0 + 14 * DIA, fin));
  assert.strictEqual(eje.huecos.length, 1);
  assert.strictEqual(eje.huecos[0].texto, '14 d');
  assert.ok(eje.aEje(fin) - eje.aEje(T0) < 2 * 3600 * 1000);
});

test('ida y vuelta: cada punto recupera su fecha real', () => {
  const puntos = [T0, T0 + 40 * MIN, T0 + 3 * DIA, T0 + 3 * DIA + 90 * MIN, T0 + 17 * DIA];
  const eje = crearEjeComprimido(lecturasCon(...puntos));
  for (const ts of puntos) assert.ok(Math.abs(eje.deEje(eje.aEje(ts)) - ts) < 1);
});

test('el orden del tiempo se mantiene y dentro del hueco no hay etiqueta', () => {
  const eje = crearEjeComprimido(lecturasCon(T0, T0 + 5 * DIA));
  assert.ok(eje.aEje(T0) < eje.aEje(T0 + DIA));
  assert.ok(eje.aEje(T0 + DIA) < eje.aEje(T0 + 5 * DIA));
  assert.strictEqual(eje.etiqueta(eje.aEje(T0 + 2 * DIA)), '');
  assert.notStrictEqual(eje.etiqueta(eje.aEje(T0)), '');
});

test('los nulos de separación y las lecturas vacías no rompen el eje', () => {
  const eje = crearEjeComprimido({ series: { ph: { 1: [[T0, 7], [T0 + 1, null], [T0 + 2 * DIA, 8]] }, nivel: {} } });
  assert.strictEqual(eje.huecos.length, 1);
  assert.strictEqual(crearEjeComprimido(null).huecos.length, 0);
});

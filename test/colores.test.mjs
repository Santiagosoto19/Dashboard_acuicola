// Las gráficas dibujan en canvas: toda variable CSS debe llegar resuelta a ECharts.
import test from 'node:test';
import assert from 'node:assert';
import { C, RAMPA_CALOR, resolverColores } from '../frontend/src/lib/colores.js';

const leer = (nombre) => ({ '--color-tinta': '#E8EEF6', '--calor-1': '#15324D' }[nombre] ?? '#000000');

test('cambia las variables anidadas sin tocar lo demás', () => {
  const formatter = () => 'texto';
  const salida = resolverColores({
    textStyle: { color: C.tinta },
    series: [{ data: [[1, 7], [2, null]], formatter, label: { color: '#16A34A' } }],
    inRange: { color: RAMPA_CALOR.slice(0, 1) },
    animation: false,
  }, leer);
  assert.strictEqual(salida.textStyle.color, '#E8EEF6');
  assert.deepStrictEqual(salida.series[0].data, [[1, 7], [2, null]]);
  assert.strictEqual(salida.series[0].formatter, formatter);
  assert.strictEqual(salida.series[0].label.color, '#16A34A');
  assert.deepStrictEqual(salida.inRange.color, ['#15324D']);
  assert.strictEqual(salida.animation, false);
});

test('no entra en objetos de clase, como los degradados de ECharts', () => {
  class Degradado { constructor() { this.color = 'var(--color-tinta)'; } }
  const degradado = new Degradado();
  assert.strictEqual(resolverColores({ areaStyle: { color: degradado } }, leer).areaStyle.color, degradado);
});

test('no modifica la opción original, porque se reutiliza al cambiar de tema', () => {
  const opcion = { textStyle: { color: C.tinta } };
  resolverColores(opcion, leer);
  assert.strictEqual(opcion.textStyle.color, C.tinta);
});

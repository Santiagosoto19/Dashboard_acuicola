// Reglas de presentación del tablero: las no negociables del brief.
import test from 'node:test';
import assert from 'node:assert';
import {
  animoMascota, armarLecturas, debeCelebrar, distanciaAlLimite, estadoDeValor, ludicoPermitido, opacidadTurbidez,
  ordenarPorSeveridad, zonasGauge, excesoRelativo,
} from '../frontend/src/lib/severidad.js';

const ph = { clave: 'ph', unidad: '', decimales: 2, escala: [0, 14], limite: { min: 6.5, max: 9.5 } };
const turbidez = { clave: 'turbidez', unidad: 'NTU', decimales: 1, escala: [0, 500], limite: { max: 100 } };

test('una lectura vieja se muestra como antigua, sin exceso ni alerta', () => {
  const estado = { variables: [ph, turbidez], margenCerca: 0.1 };
  const nodo = { nodo: 1, lecturas: {}, conocidas: { ph: { valor: 11, ts: 1000 } } };
  const [lecturaPh, lecturaTurbidez] = armarLecturas(estado, [nodo]);
  assert.strictEqual(lecturaPh.estado, 'antigua');
  assert.strictEqual(lecturaPh.exceso, 0);
  assert.strictEqual(lecturaPh.conocida.valor, 11);
  assert.strictEqual(lecturaPh.nodo, 1);
  assert.strictEqual(lecturaTurbidez.estado, 'sin_dato');
});

test('una lectura vigente manda sobre la guardada', () => {
  const estado = { variables: [ph], margenCerca: 0.1 };
  const nodo = { nodo: 1, lecturas: { ph: { valor: 7, ts: 2000, vigente: true } }, conocidas: { ph: { valor: 7, ts: 2000 } } };
  assert.strictEqual(armarLecturas(estado, [nodo])[0].estado, 'dentro');
});

test('estado de valor: fuera, cerca, dentro y sin dato', () => {
  assert.strictEqual(estadoDeValor(ph, null), 'sin_dato');
  assert.strictEqual(estadoDeValor(ph, 5), 'fuera');
  assert.strictEqual(estadoDeValor(ph, 6.6), 'cerca');
  assert.strictEqual(estadoDeValor(ph, 8), 'dentro');
  assert.strictEqual(estadoDeValor(ph, 9.5), 'cerca');
  assert.strictEqual(estadoDeValor(turbidez, 95), 'cerca');
  assert.strictEqual(estadoDeValor(turbidez, 100.1), 'fuera');
});

test('las zonas del gauge cubren la escala sin huecos y respetan los límites', () => {
  for (const v of [ph, turbidez]) {
    const zonas = zonasGauge(v);
    assert.strictEqual(zonas[0].desde, v.escala[0]);
    assert.strictEqual(zonas[zonas.length - 1].hasta, v.escala[1]);
    zonas.slice(1).forEach((z, i) => assert.strictEqual(z.desde, zonas[i].hasta));
  }
  const criticas = zonasGauge(ph).filter((z) => z.tono === 'critica');
  assert.deepStrictEqual(criticas.map((z) => [z.desde, z.hasta]), [[0, 6.5], [9.5, 14]]);
  assert.deepStrictEqual(zonasGauge(turbidez).filter((z) => z.tono === 'critica').map((z) => [z.desde, z.hasta]), [[100, 500]]);
});

test('el orden va de crítica a sin dato y prioriza el mayor exceso', () => {
  const item = (clave, v, valor) => ({ clave, estado: estadoDeValor(v, valor), exceso: excesoRelativo(v, valor) });
  const orden = ordenarPorSeveridad([
    item('sin', ph, null), item('bien', ph, 8), item('poco', turbidez, 110), item('mucho', turbidez, 400), item('cerca', ph, 6.6),
  ]).map((x) => x.clave);
  assert.deepStrictEqual(orden, ['mucho', 'poco', 'cerca', 'bien', 'sin']);
});

test('distancia al límite en lenguaje del operador', () => {
  assert.strictEqual(distanciaAlLimite(turbidez, 211.3), '+111.3 NTU sobre el máximo');
  assert.strictEqual(distanciaAlLimite(ph, 6), '0.5 bajo el mínimo');
});

test('lo lúdico nunca con crítica, datos viejos o movimiento reducido', () => {
  const vivo = { nivel: 'normal', desactualizado: false, movimientoReducido: false };
  assert.strictEqual(ludicoPermitido(vivo), true);
  assert.strictEqual(ludicoPermitido({ ...vivo, nivel: 'critica' }), false);
  assert.strictEqual(ludicoPermitido({ ...vivo, desactualizado: true }), false);
  assert.strictEqual(ludicoPermitido({ ...vivo, movimientoReducido: true }), false);
});

test('solo se celebra al volver a Normal desde un problema real en vivo', () => {
  const n = (nivel, desactualizado = false) => ({ nivel, desactualizado });
  assert.strictEqual(debeCelebrar(n('critica'), n('normal')), true);
  assert.strictEqual(debeCelebrar(n('advertencia'), n('normal')), true);
  assert.strictEqual(debeCelebrar(n('normal'), n('normal')), false, 'sin cambio');
  assert.strictEqual(debeCelebrar(null, n('normal')), false, 'primera carga');
  assert.strictEqual(debeCelebrar(n('normal'), n('critica')), false);
  assert.strictEqual(debeCelebrar(n('advertencia'), n('critica')), false, 'empeora');
  assert.strictEqual(debeCelebrar(n('critica', true), n('normal')), false, 'venía de datos viejos');
  assert.strictEqual(debeCelebrar(n('critica'), n('normal', true)), false, 'datos viejos');
  assert.strictEqual(debeCelebrar(n('critica'), n('normal'), true), false, 'movimiento reducido');
});

test('la mascota no finge saber: sin comunicación manda sobre el nivel', () => {
  assert.strictEqual(animoMascota({ nivel: 'critica', desactualizado: true }), 'sin_comunicacion');
  assert.strictEqual(animoMascota({ nivel: 'critica', desactualizado: false }), 'critica');
});

test('la turbidez del agua es proporcional al NTU y sin dato no enturbia', () => {
  assert.strictEqual(opacidadTurbidez(null), 0);
  assert.ok(opacidadTurbidez(100) < opacidadTurbidez(300));
  assert.strictEqual(opacidadTurbidez(5000), 0.78);
});

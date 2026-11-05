// Lógica de presentación del estado. Sin React, para poder probarla con node --test.

// Estado de UNA variable. La regla de la rúbrica (normal/advertencia/crítica) se
// calcula en el servidor; esto solo decide cómo pintar cada lectura.
export const ESTADO_VARIABLE = {
  fuera: { orden: 0, etiqueta: 'Fuera de límites', tono: 'critica' },
  cerca: { orden: 1, etiqueta: 'Cerca del límite', tono: 'advertencia' },
  dentro: { orden: 2, etiqueta: 'Dentro de límites', tono: 'normal' },
  antigua: { orden: 3, etiqueta: 'Lectura antigua', tono: 'sin_dato' },
  sin_dato: { orden: 4, etiqueta: 'Sin lectura reciente', tono: 'sin_dato' },
};

// Una entrada por variable, con la lectura vigente más reciente de los nodos visibles.
// Si ya no hay ninguna vigente, se muestra la última guardada como "antigua": se ve el
// valor y su fecha, pero nunca cuenta como alerta porque no describe el estanque de ahora.
export function armarLecturas(estado, nodos) {
  return estado.variables.map((variable) => {
    const lectura = nodos
      .filter((n) => n.lecturas[variable.clave]?.vigente)
      .map((n) => ({ nodo: n.nodo, ...n.lecturas[variable.clave] }))
      .sort((a, b) => b.ts - a.ts)[0] ?? null;
    const conocida = nodos
      .filter((n) => n.conocidas?.[variable.clave])
      .map((n) => ({ nodo: n.nodo, ...n.conocidas[variable.clave] }))
      .sort((a, b) => b.ts - a.ts)[0] ?? null;
    let estadoLectura = estadoDeValor(variable, lectura?.valor ?? null, estado.margenCerca);
    if (!lectura && conocida) estadoLectura = 'antigua';
    return {
      variable,
      lectura,
      conocida,
      nodo: lectura?.nodo ?? conocida?.nodo ?? null,
      estado: estadoLectura,
      exceso: excesoRelativo(variable, lectura?.valor ?? null),
    };
  });
}

// Ancho de la zona "cerca del límite" para una variable.
export function margenDe(limite, fraccion) {
  const { min, max } = limite;
  if (min !== undefined && max !== undefined) return (max - min) * fraccion;
  return Math.abs(max ?? min ?? 0) * fraccion;
}

export function estadoDeValor(variable, valor, fraccion = 0.1) {
  if (valor === null || valor === undefined) return 'sin_dato';
  const { min, max } = variable.limite;
  if ((min !== undefined && valor < min) || (max !== undefined && valor > max)) return 'fuera';
  const margen = margenDe(variable.limite, fraccion);
  if ((min !== undefined && valor < min + margen) || (max !== undefined && valor > max - margen)) return 'cerca';
  return 'dentro';
}

// Cuánto se sale el valor, en proporción al rango permitido. Sirve para decidir
// cuál variable es la más grave cuando varias están fuera de límites.
export function excesoRelativo(variable, valor) {
  if (valor === null || valor === undefined) return 0;
  const { min, max } = variable.limite;
  const base = min !== undefined && max !== undefined ? max - min : Math.abs(max ?? min ?? 1) || 1;
  if (max !== undefined && valor > max) return (valor - max) / base;
  if (min !== undefined && valor < min) return (min - valor) / base;
  return 0;
}

// Ordena de más a menos grave. Dentro de cada estado, primero la de mayor exceso.
export function ordenarPorSeveridad(lecturas) {
  return [...lecturas].sort((a, b) => {
    const porEstado = ESTADO_VARIABLE[a.estado].orden - ESTADO_VARIABLE[b.estado].orden;
    return porEstado || b.exceso - a.exceso;
  });
}

// Zonas del arco del gauge, en valores de la escala de la variable.
export function zonasGauge(variable, fraccion = 0.1) {
  const [a, b] = variable.escala;
  const { min, max } = variable.limite;
  const margen = margenDe(variable.limite, fraccion);
  const recortar = (x) => Math.min(b, Math.max(a, x));
  const zonas = [];
  let cursor = a;
  const agregar = (hasta, tono) => {
    const fin = recortar(hasta);
    if (fin > cursor) zonas.push({ desde: cursor, hasta: fin, tono });
    cursor = Math.max(cursor, fin);
  };
  if (min !== undefined) {
    agregar(min, 'critica');
    agregar(min + margen, 'advertencia');
  }
  if (max !== undefined) {
    agregar(max - margen, 'normal');
    agregar(max, 'advertencia');
    agregar(b, 'critica');
  } else {
    agregar(b, 'normal');
  }
  return zonas;
}

// "+111.3 NTU sobre el máximo", en lenguaje del operador.
export function distanciaAlLimite(variable, valor) {
  if (valor === null || valor === undefined) return null;
  const { min, max } = variable.limite;
  const u = variable.unidad ? ` ${variable.unidad}` : '';
  const n = (x) => Number(x.toFixed(variable.decimales));
  if (max !== undefined && valor > max) return `+${n(valor - max)}${u} sobre el máximo`;
  if (min !== undefined && valor < min) return `${n(min - valor)}${u} bajo el mínimo`;
  const candidatos = [];
  if (max !== undefined) candidatos.push(`${n(max - valor)}${u} para el máximo`);
  if (min !== undefined) candidatos.push(`${n(valor - min)}${u} sobre el mínimo`);
  return candidatos.join(' · ');
}

// Regla no negociable: lo lúdico solo con datos en vivo y sin estado crítico.
export function ludicoPermitido({ nivel, desactualizado, movimientoReducido }) {
  return !movimientoReducido && !desactualizado && nivel !== 'critica';
}

// Las burbujas de celebración salen solo al volver a Normal desde un problema real.
export function debeCelebrar(previo, actual, movimientoReducido = false) {
  if (!previo || !actual) return false;
  const veniaMal = previo.nivel === 'advertencia' || previo.nivel === 'critica';
  return veniaMal
    && !previo.desactualizado
    && actual.nivel === 'normal'
    && ludicoPermitido({ ...actual, movimientoReducido });
}

// Estado de ánimo de la mascota: sin comunicación manda sobre cualquier nivel,
// porque no sabemos cómo está el agua ahora.
export function animoMascota({ nivel, desactualizado }) {
  if (desactualizado || nivel === 'sin_datos') return 'sin_comunicacion';
  return nivel;
}

// Opacidad de la capa de turbidez, proporcional al NTU real. El tope de 500 NTU
// coincide con la escala del gauge.
export function opacidadTurbidez(ntu) {
  if (ntu === null || ntu === undefined) return 0;
  return Math.min(0.78, (Math.max(0, ntu) / 500) * 0.78);
}

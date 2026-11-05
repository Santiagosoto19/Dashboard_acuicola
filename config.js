// Configuración editable del dashboard. Ninguna consulta SQL contiene límites:
// todos se evalúan aquí, para que cambiarlos no exija tocar el SQL.

// Límites por variable. Omita "min" o "max" si ese lado no aplica.
// IMPORTANTE: la especie no está definida, así que son valores de referencia del
// proyecto y no rangos biológicos. Copian min_seguro y max_seguro de la tabla
// `variables` (la que usa sp_procesar_evento_iot): si cambian allá, cámbielos aquí.
// La turbidez no está en esa tabla, así que su límite solo existe en este archivo.
const LIMITES = {
  ph: { min: 6.5, max: 8.5 },
  turbidez: { max: 100 },
  temperatura: { min: 24, max: 30 },
  tds: { max: 600 },
  nivel: { min: 60, max: 95 },
};

// Variables mostradas. "escala" solo define el recorrido de los gauges.
const VARIABLES = [
  { clave: 'ph', etiqueta: 'pH', unidad: '', escala: [0, 14], decimales: 2 },
  { clave: 'temperatura', etiqueta: 'Temperatura', unidad: '°C', escala: [0, 50], decimales: 1 },
  { clave: 'turbidez', etiqueta: 'Turbidez', unidad: 'NTU', escala: [0, 500], decimales: 1 },
  { clave: 'tds', etiqueta: 'TDS', unidad: 'ppm', escala: [0, 1000], decimales: 0 },
  { clave: 'nivel', etiqueta: 'Nivel', unidad: 'cm', escala: [0, 100], decimales: 1 },
];

module.exports = {
  PUERTO: Number(process.env.PORT) || 3000,
  ZONA_HORARIA: 'America/Bogota',
  // Colombia no aplica horario de verano: UTC-5 fijo.
  DESFASE_BOGOTA_MS: -5 * 3600 * 1000,

  // nivel = ALTURA_SENSOR_CM - distancia_cm
  ALTURA_SENSOR_CM: Number(process.env.ALTURA_SENSOR_CM) || 100,

  // Intervalo de envío de los nodos, observado en la tabla paquetes.
  INTERVALO_MEDICION_S: 30,
  // Un nodo queda "sin comunicación" tras este número de intervalos sin datos.
  INTERVALOS_SIN_COMUNICACION: 3,
  // Una lectura deja de contar para el estado tras este número de intervalos
  // sin repetirse: así un pH de hace dos semanas no dispara una alerta de hoy.
  INTERVALOS_VIGENCIA: 10,
  // Sin mediciones durante estos minutos, la interfaz marca los datos como
  // desactualizados: lo que muestra ya no describe el estanque de ahora.
  MINUTOS_DESACTUALIZADO: 5,
  // Zona "cerca del límite" dentro del rango permitido, como fracción del rango
  // (o del límite, si solo hay uno). Es informativa: no cuenta como anormal.
  MARGEN_CERCA: 0.1,

  CACHE_TTL_MS: 10 * 1000,
  RANGO_MAX_DIAS: 90,
  MAX_PUNTOS_SERIE: 800,
  MAX_ALERTAS_RECIENTES: 200,

  LIMITES,
  VARIABLES,
};

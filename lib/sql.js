// Consultas SQL comentadas. Todas son de solo lectura y parametrizadas ($1, $2...).
// Los límites NO aparecen aquí: se evalúan en lib/evaluacion.js con config.js.
//
// Particularidades de los datos reales que estas consultas resuelven:
//  1. payload a veces es un objeto {...} y a veces un arreglo [{nodo:1,...},{nodo:2,...}]
//     (49 de 348 paquetes), así que primero se expande a un mensaje por fila.
//  2. Un campo puede faltar. jsonb_typeof evita fallos de conversión si llega algo
//     que no es número: lo que no sea numérico queda en NULL ("sin dato").
//  3. Los mensajes antiguos usan la clave "tds" en vez de "tds_ppm".
//  4. La turbidez no tiene fila en "variables" ni en "lecturas": por eso se lee
//     siempre del payload y no de la tabla lecturas.

// Expande cada paquete a un mensaje por nodo. "origen" es texto fijo de este
// archivo, nunca una entrada del usuario.
const expandir = (origen) => `
  SELECT o.id, o.recibido_en, m
  FROM ${origen} o
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o.payload) = 'array' THEN o.payload
         ELSE jsonb_build_array(o.payload) END
  ) AS m`;

// Extrae los campos de cada mensaje con ->> y los convierte de forma segura.
const CAMPOS = `
  SELECT id, recibido_en,
    CASE WHEN m->>'nodo' ~ '^[0-9]{1,6}$' THEN (m->>'nodo')::int END AS nodo,
    CASE WHEN jsonb_typeof(m->'ph') = 'number' THEN (m->>'ph')::float8 END AS ph,
    CASE WHEN jsonb_typeof(m->'turbidez_ntu') = 'number' THEN (m->>'turbidez_ntu')::float8 END AS turbidez_ntu,
    CASE WHEN jsonb_typeof(m->'temp_c') = 'number' THEN (m->>'temp_c')::float8 END AS temp_c,
    CASE WHEN jsonb_typeof(m->'distancia_cm') = 'number' THEN (m->>'distancia_cm')::float8 END AS distancia_cm,
    CASE WHEN jsonb_typeof(m->'tds_ppm') = 'number' THEN (m->>'tds_ppm')::float8
         WHEN jsonb_typeof(m->'tds') = 'number' THEN (m->>'tds')::float8 END AS tds_ppm
  FROM mensajes`;

const COLUMNAS = `id::text AS paquete_id, recibido_en, nodo, ph, turbidez_ntu, temp_c, distancia_cm, tds_ppm`;

module.exports = {
  // Mediciones de un rango. Usa idx_paquetes_tiempo para acotar por recibido_en.
  // $1 desde, $2 hasta, $3 nodos (int[]; NULL = todos).
  MEDICIONES_RANGO: `
    WITH rango AS (
      SELECT id, recibido_en, payload FROM paquetes
      WHERE recibido_en >= $1 AND recibido_en <= $2
    ),
    mensajes AS (${expandir('rango')}),
    campos AS (${CAMPOS})
    SELECT ${COLUMNAS} FROM campos
    WHERE nodo IS NOT NULL AND ($3::int[] IS NULL OR nodo = ANY($3))
    ORDER BY recibido_en, id, nodo`,

  // Últimas mediciones de cada nodo, para el estado actual y la variación.
  // Solo revisa los últimos $1 paquetes, para que el costo no crezca con la tabla.
  // $2 = mediciones por nodo.
  ULTIMAS_POR_NODO: `
    WITH recientes AS (
      SELECT id, recibido_en, payload FROM paquetes
      ORDER BY recibido_en DESC LIMIT $1
    ),
    mensajes AS (${expandir('recientes')}),
    campos AS (${CAMPOS}),
    numeradas AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY nodo ORDER BY recibido_en DESC, id DESC) AS fila
      FROM campos WHERE nodo IS NOT NULL
    )
    SELECT ${COLUMNAS} FROM numeradas WHERE fila <= $2
    ORDER BY recibido_en, id, nodo`,

  // Última lectura conocida de cada variable por nodo, por antigua que sea, para
  // poder decir "última lectura: 13 oct" cuando un sensor dejó de reportar.
  // array_agg(... FILTER) toma el valor más reciente no nulo. $1 = paquetes a revisar.
  ULTIMA_CONOCIDA: `
    WITH recientes AS (
      SELECT id, recibido_en, payload FROM paquetes
      ORDER BY recibido_en DESC LIMIT $1
    ),
    mensajes AS (${expandir('recientes')}),
    campos AS (${CAMPOS})
    SELECT nodo,
      MAX(recibido_en) FILTER (WHERE ph IS NOT NULL) AS ph_ts,
      (ARRAY_AGG(ph ORDER BY recibido_en DESC) FILTER (WHERE ph IS NOT NULL))[1] AS ph,
      MAX(recibido_en) FILTER (WHERE turbidez_ntu IS NOT NULL) AS turbidez_ts,
      (ARRAY_AGG(turbidez_ntu ORDER BY recibido_en DESC) FILTER (WHERE turbidez_ntu IS NOT NULL))[1] AS turbidez,
      MAX(recibido_en) FILTER (WHERE temp_c IS NOT NULL) AS temperatura_ts,
      (ARRAY_AGG(temp_c ORDER BY recibido_en DESC) FILTER (WHERE temp_c IS NOT NULL))[1] AS temperatura,
      MAX(recibido_en) FILTER (WHERE tds_ppm IS NOT NULL) AS tds_ts,
      (ARRAY_AGG(tds_ppm ORDER BY recibido_en DESC) FILTER (WHERE tds_ppm IS NOT NULL))[1] AS tds,
      MAX(recibido_en) FILTER (WHERE distancia_cm >= 0) AS nivel_ts,
      (ARRAY_AGG(distancia_cm ORDER BY recibido_en DESC) FILTER (WHERE distancia_cm >= 0))[1] AS distancia
    FROM campos WHERE nodo IS NOT NULL
    GROUP BY nodo`,

  // Una página de la auditoría, de la medición más nueva a la más vieja.
  // $1 desde, $2 hasta, $3 nodos, $4 tamaño de página, $5 desplazamiento.
  AUDITORIA_PAGINA: `
    WITH rango AS (
      SELECT id, recibido_en, payload FROM paquetes
      WHERE recibido_en >= $1 AND recibido_en <= $2
    ),
    mensajes AS (${expandir('rango')}),
    campos AS (${CAMPOS})
    SELECT ${COLUMNAS} FROM campos
    WHERE nodo IS NOT NULL AND ($3::int[] IS NULL OR nodo = ANY($3))
    ORDER BY recibido_en DESC, id DESC, nodo
    LIMIT $4 OFFSET $5`,

  // Total de mediciones del rango, para calcular el número de páginas.
  AUDITORIA_TOTAL: `
    WITH rango AS (
      SELECT id, recibido_en, payload FROM paquetes
      WHERE recibido_en >= $1 AND recibido_en <= $2
    ),
    mensajes AS (${expandir('rango')}),
    campos AS (${CAMPOS})
    SELECT COUNT(*)::int AS total FROM campos
    WHERE nodo IS NOT NULL AND ($3::int[] IS NULL OR nodo = ANY($3))`,

  // Telemetría histórica por nodo: mensajes, lecturas no nulas y último paquete.
  TELEMETRIA: `
    WITH mensajes AS (${expandir('paquetes')}),
    campos AS (${CAMPOS})
    SELECT nodo,
      COUNT(*)::int AS mensajes,
      (COUNT(ph) + COUNT(turbidez_ntu) + COUNT(temp_c) + COUNT(distancia_cm) + COUNT(tds_ppm))::int AS lecturas,
      MAX(recibido_en) AS ultimo_paquete
    FROM campos WHERE nodo IS NOT NULL
    GROUP BY nodo ORDER BY nodo`,

  // Nodos registrados. El gateway (nodo_payload NULL) no reporta mediciones.
  DISPOSITIVOS: `
    SELECT nodo_payload AS nodo, rol, referencia
    FROM dispositivos
    WHERE nodo_payload IS NOT NULL
    ORDER BY nodo_payload`,

  // Eventos de sp_procesar_evento_iot cuyo periodo se cruza con el rango.
  // $1 desde, $2 hasta.
  EVENTOS: `
    SELECT e.id::text AS id, e.tipo, e.severidad, v.clave AS variable, v.unidad,
           e.valor::float8 AS valor, e.estado, e.repeticiones,
           e.ocurrido_en, e.ultima_vez_en, e.resuelto_en
    FROM eventos e
    LEFT JOIN variables v ON v.id = e.variable_id
    WHERE e.ultima_vez_en >= $1 AND e.ocurrido_en <= $2
    ORDER BY e.ultima_vez_en DESC
    LIMIT 50`,
};

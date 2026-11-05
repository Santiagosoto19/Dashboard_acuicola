# Dashboard de monitoreo acuícola

Tablero web de la calidad del agua de un estanque piscícola. Es la capa de aplicación de un sistema IoT con dos nodos ESP32 que se comunican por LoRa y miden pH, turbidez, temperatura, TDS y nivel del agua. Los datos llegan a una base PostgreSQL en Supabase. El tablero **solo lee** esa base: nunca escribe en ella.

**Tecnologías:** Node.js, Express y `pg` en el servidor; React, Vite, Tailwind CSS, Motion y Apache ECharts en el cliente.

## Qué muestra

| Pestaña | Contenido |
|---|---|
| **Resumen** | Estado general del estanque, tarjeta por nodo, gauge por variable, mascota animada, línea de tiempo del estado y distribución de severidades |
| **Variables** | Una gráfica por variable (área, líneas, barras o dispersión) y una comparativa entre los dos nodos |
| **Alertas** | Conteos por variable y nodo, porcentaje de lecturas anormales, alertas recientes y eventos registrados en la base |
| **Histórico** | Serie histórica, mapa de calor por hora y día, histograma y auditoría paginada de cada medición |
| **Nodos** | Conexión, último paquete y totales de cada nodo |

También permite:
- Filtrar por nodo y por rango: 1 h, 6 h, 24 h, 7 días, 24 h hasta la última medición, todo el historial o un rango personalizado.
- Descargar las mediciones del rango en CSV.
- Abrir el detalle de cada variable con sus estadísticas.
- Cambiar entre modo claro y oscuro con el botón de la cabecera. La elección se guarda; si no hay elección, sigue al sistema.
- Ver escenarios simulados con `?demo=` (ver [Modo demostración](#modo-demostración)).

## Reglas de estado

| Nivel | Condición |
|---|---|
| **Normal** | Ninguna variable fuera de límites |
| **Advertencia** | Una variable fuera de límites |
| **Crítica** | Dos o más variables fuera de límites, en uno o más nodos |

- Un campo que no llega es **sin dato**, nunca un valor anormal.
- Una lectura deja de contar para el estado si no se repite en 10 intervalos de medición (5 min).
- Si no hay mediciones en los últimos 5 min, el tablero marca los datos como **desactualizados**. Un nodo sin datos durante 90 s queda **sin comunicación**.
- Si una variable dejó de reportar, su tarjeta muestra el último valor guardado como **lectura antigua**, en gris y con su fecha. Ese valor no cuenta como alerta.
- Si no hay datos en las últimas 24 h, el tablero pasa solo a **todo el historial**. En las gráficas, los periodos largos sin datos se recortan y se marcan con una franja gris que indica cuánto se saltó (por ejemplo, «14 d»).

### Límites

Están en `config.js` y copian `min_seguro` y `max_seguro` de la tabla `variables` de la base, que es la que usa `sp_procesar_evento_iot` para generar eventos. **Si cambian en la base, hay que cambiarlos también en `config.js`.**

| Variable | Rango permitido |
|---|---|
| pH | 6,5 – 8,5 |
| Temperatura | 24 – 30 °C |
| TDS | máx. 600 ppm |
| Nivel | 60 – 95 cm |
| Turbidez | máx. 100 NTU (solo en `config.js`: no está en la tabla `variables`) |

La especie no está definida, así que estos son valores de referencia del proyecto, no rangos biológicos.

## Requisitos

- Node.js 18 o superior.
- La cadena de conexión a la base de Supabase.

## Ejecución local

```bash
cp .env.example .env   # luego ponga su DATABASE_URL
npm install
npm run build          # compila el cliente React en public/
npm start              # http://localhost:3100
```

El puerto sale de `PORT` en `.env`. Si no se define, es 3000.

Para trabajar en el cliente con recarga en caliente, ejecute `npm start` en una terminal y `npm run dev` en otra, y abra http://localhost:5173. Vite reenvía `/api` al puerto 3100; si el servidor usa otro, ajuste `frontend/vite.config.js`.

Después de cambiar algo en `frontend/`, vuelva a ejecutar `npm run build` para que `npm start` sirva la versión nueva.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de Supabase (pooler en modo transacción, puerto 6543). No agregue `?sslmode=`: el SSL se configura en `lib/db.js` |
| `PORT` | No | Puerto del servidor. Por defecto, 3000 |
| `ALTURA_SENSOR_CM` | No | Altura del sensor ultrasónico. El nivel se calcula como `ALTURA_SENSOR_CM - distancia_cm`. Por defecto, 100 |

## Pruebas

```bash
npm test
```

Prueban las reglas de alerta, los límites, la presentación de cada estado, el eje que recorta los huecos y la conversión de colores del tema. No necesitan base de datos.

## Modo demostración

Agregue `?demo=` a la URL para ver cada estado con datos simulados. La página muestra siempre un aviso de que no son mediciones reales.

| Escenario | URL |
|---|---|
| Normal | `/?demo=normal` |
| Advertencia | `/?demo=advertencia` |
| Crítica | `/?demo=critica` |
| Sin comunicación | `/?demo=sin-comunicacion` |
| Recuperación (pasa a Normal a los 14 s) | `/?demo=recuperacion` |

## Despliegue gratuito en Render

1. **Cree un repositorio solo para el proyecto**, dentro de esta carpeta:
   ```bash
   git init -b main
   git add .
   git status   # confirme que NO aparezcan .env ni node_modules
   git commit -m "Dashboard de monitoreo acuícola"
   ```
   `.env` está en `.gitignore`: nunca lo suba.
2. **Súbalo a GitHub**, por ejemplo con `gh repo create dashboard-acuicola --private --source=. --push`.
3. **En Render**, cree un Web Service conectado al repositorio:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Variable de entorno:** `DATABASE_URL`. El puerto lo asigna Render.
4. Abra la URL que entrega Render.

En Railway, los comandos y la variable son los mismos.

**Tenga en cuenta:**
- La URL pública no tiene inicio de sesión: quien la tenga puede ver los datos.
- El plan gratis de Render se duerme tras unos 15 min sin visitas, y la primera carga después tarda cerca de un minuto. Ábrala unos minutos antes de una presentación.

## API

Todas las rutas son de solo lectura.

| Ruta | Devuelve |
|---|---|
| `GET /api/estado` | Estado general y por nodo, última lectura, hora y lecturas guardadas de cada variable |
| `GET /api/lecturas?desde=&hasta=&nodos=` | Series por variable y nodo, más los datos de las gráficas |
| `GET /api/alertas?desde=&hasta=&nodos=` | Alertas recientes, conteos y eventos de la base |
| `GET /api/nodos` | Telemetría y conexión de cada nodo |
| `GET /api/auditoria?desde=&hasta=&nodos=&pagina=&tam=` | Mediciones paginadas con su estado |
| `GET /api/export.csv?desde=&hasta=&nodos=` | Descarga en CSV |

- **Fechas:** en ISO 8601. Sin `desde` ni `hasta`, el rango son las últimas 24 h. El máximo es 90 días.
- **Nodos:** separados por coma, por ejemplo `nodos=1,2`. Sin el parámetro, se incluyen todos.
- **Errores:** un parámetro inválido responde 400; si la base no responde, 503.

## Configuración

Todo está en `config.js`: límites, altura del sensor, intervalo de medición, vigencia de las lecturas, minutos para marcar datos desactualizados, margen de «cerca del límite» y rango máximo de consulta.

El diseño visual, sus tokens y las reglas del modo oscuro están en `DESIGN.md`. El propósito y las reglas del producto están en `PRODUCT.md`.

## Estructura

```
server.js            arranque, archivos estáticos y manejo de errores
config.js            límites y parámetros editables
routes/              una ruta por recurso de la API
lib/sql.js           todas las consultas SQL, comentadas
lib/evaluacion.js    limpieza de datos y niveles de alerta
lib/analisis.js      datos de cada gráfica
lib/datos.js         lectura compartida y validación de parámetros
lib/db.js            conexión y transacciones de solo lectura
lib/cache.js         caché de 10 s por consulta
frontend/src/        cliente React
  paneles/           una pestaña por archivo
  components/        tarjetas, gauges, gráficas, mascota y cabecera
  hooks/             consulta periódica de la API (cada 10 s)
  lib/               severidad, formato, tema, colores, eje y datos de demostración
public/              cliente compilado, generado por npm run build
public_oscuro/       versión anterior del tablero, sin servir
test/                pruebas con node --test
```

# Guía de diseño

Agua como idea central, en modo claro u oscuro. Lo decorativo vive en el fondo y en la pecera; el estado del estanque siempre manda.

## Modo oscuro
El botón de la cabecera alterna el tema y guarda la elección; sin elección, sigue al sistema. Los valores están en `:root[data-tema="oscuro"]` de `index.css`: fondo `#0B1220`, superficie `#131C2E`, tinta `#E8EEF6`, `#AEBBCD`, `#8E9DB2`. Los rellenos semánticos y los colores de nodo no cambian; las tintas y los fondos suaves sí, para conservar AA. Las tablas de abajo describen el modo claro.

## Color
Los tokens están en `frontend/src/index.css`. `frontend/src/lib/colores.js` los referencia como variables CSS y Lienzo las resuelve para ECharts.

| Rol | Valor | Uso |
|---|---|---|
| Fondo | `#FAFAFA` + mesh cian/azul/violeta al 5–6 % | Página |
| Superficie | `#FFFFFF`, borde `rgba(15,23,42,.06)` | Tarjetas |
| Vidrio | blanco al 70 %, blur 24 px | Solo lo superpuesto: cabecera, filtros, tooltips, drawer |
| Tinta | `#0F172A`, `#475569`, `#64748B` | Texto, en tres niveles. Todos cumplen AA sobre el fondo |
| Marca | `#06B6D4 → #3B82F6 → #8B5CF6` | Pestaña activa, pill activa, foco |
| Lima | `#A3E635` | Logro y chispas. Nunca como texto |
| Nodo 1 / Nodo 2 | `#3B82F6` / `#EA5A3A` | Identidad en todas las gráficas |

### Semántica
Separada de la marca, y siempre con icono y texto.

| Estado | Relleno | Texto (AA) | Fondo suave |
|---|---|---|---|
| Normal | `#16A34A` | `#166534` | `#DCFCE7` |
| Advertencia | `#F59E0B` | `#92400E` | `#FEF3C7` |
| Crítica | `#E11D48` | `#BE123C` | `#FFE4E6` |
| Sin dato | `#94A3B8` + rayado | `#475569` | `#F1F5F9` |

Los rellenos no sirven como texto: el ámbar sobre blanco no llega a 2:1. Por eso cada estado tiene su tinta.

## Forma y profundidad
- Radio de tarjeta: 16 px (`rounded-2xl`).
- Sombra base: `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -8px rgba(59,130,246,.12)`.
- Sombra alta: `0 1px 2px rgba(0,0,0,.05), 0 20px 44px -12px rgba(59,130,246,.2)`. La usa el nodo en peor estado.

## Tipografía
Inter para todo, autoalojada. Los números usan `tabular-nums` en tablas y deltas. Los valores principales van a 32 px y la tarjeta destacada a 40 px, en peso 700. El nivel del hero va a 40 px.

## Movimiento
Definido en `frontend/src/lib/movimiento.js`.

| Token | Valor | Uso |
|---|---|---|
| Resorte de interfaz | stiffness 300, damping 30 | Pestañas, pills, reorden, drawer, tilt |
| Resorte de aguja | stiffness 140, damping 18 | Agujas de los gauges |
| Salida exponencial | `cubic-bezier(.16,1,.3,1)`, 500 ms | Entrada de tarjetas, conteo de valores |
| Escalonado | 70 ms | Orden de entrada: hero, nodos, lecturas, gráficas |
| Rápida | 150 ms | Tooltip, fundidos |

Los bucles animan solo `transform` y `opacity`. El contador orbita con rotación y las líneas de tiempo crecen con escala, no con ancho. La única excepción es el `blur` de la entrada de tarjetas, que pide el brief, y ocurre una sola vez.

## Reglas de lo lúdico
Están en `frontend/src/lib/severidad.js` y tienen pruebas en `test/severidad.test.mjs`.
- Burbujas, chispas y logros: solo con datos en vivo y sin estado crítico.
- La celebración solo ocurre al pasar de un problema real a Normal.
- Con `prefers-reduced-motion`: sin tilt, partículas, burbujas ni mesh; solo fundidos cortos.

## Estado de una variable y nivel general
Son cosas distintas, a propósito.
- **Nivel general** (rúbrica, calculado en el servidor): una variable anormal es Advertencia; dos o más, Crítica.
- **Estado de cada variable** (gauge): dentro, cerca o fuera de sus límites. "Cerca" es informativo: avisa pronto, pero no cuenta como anormal ni sube el nivel.

## Lo que no se hace
Texto en degradado, emoji como iconos, rótulos pequeños sobre los títulos, vidrio sobre superficies que no se superponen.

# Producto

## Qué es
Tablero de monitoreo de la calidad del agua de un estanque piscícola. Capa de aplicación de un sistema IoT con 2 nodos (ESP32 por LoRa) que miden pH, turbidez, temperatura, TDS y nivel. La especie no está definida: no se fijan rangos biológicos por especie.

## Para quién
Un operador del estanque que abre el tablero para saber si debe actuar. También lo evalúa un jurado académico con una rúbrica.

## Qué significa que funcione
El operador entiende el estado del estanque en menos de 3 segundos, y nunca confunde datos viejos con datos actuales.

## Verdades del producto
- Niveles según la rúbrica: Normal (ninguna variable anormal), Advertencia (una), Crítica (dos o más, en uno o más nodos).
- Un campo faltante es "sin dato", nunca un valor anormal.
- "Servidor conectado" y "nodos reportando" son hechos distintos.
- Fechas en español, zona America/Bogota.
- Solo lectura: el tablero no escribe en la base de datos.

## Tono
Claro, directo y en español. La mascota da personalidad, pero una alerta crítica siempre manda sobre lo decorativo.

## Fuera de alcance
Autenticación, configuración de límites desde la interfaz y acciones sobre los nodos.

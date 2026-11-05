// Colores para ECharts y SVG, que no pueden leer clases de Tailwind.
// Los neutros son variables CSS, para que sigan el tema: el SVG las entiende y, como el
// canvas de ECharts no, Lienzo las convierte con resolverColores() antes de dibujar.
// Los colores semánticos y de nodo son iguales en los dos temas.
export const C = {
  superficie: 'var(--color-superficie)',
  tinta: 'var(--color-tinta)',
  tinta2: 'var(--color-tinta-2)',
  tinta3: 'var(--color-tinta-3)',
  linea: 'var(--grafica-linea)',
  eje: 'var(--grafica-eje)',
  normal: '#16A34A',
  advertencia: '#F59E0B',
  critica: '#E11D48',
  sin_dato: '#94A3B8',
};
// El color sigue al nodo: filtrar no repinta a los demás.
const NODOS = ['#3B82F6', '#EA5A3A', '#0D9488'];
export const colorNodo = (nodo) => NODOS[(Number(nodo) - 1) % NODOS.length];
export const RAMPA_CALOR = ['var(--calor-1)', 'var(--calor-2)', 'var(--calor-3)', 'var(--calor-4)'];

// Copia una opción de ECharts cambiando cada var(--x) por su valor actual. Solo recorre
// objetos simples y listas: funciones y degradados de ECharts pasan tal cual.
export function resolverColores(valor, leer) {
  if (typeof valor === 'string') {
    return valor.includes('var(--') ? valor.replace(/var\((--[\w-]+)\)/g, (_, nombre) => leer(nombre)) : valor;
  }
  if (Array.isArray(valor)) return valor.map((v) => resolverColores(v, leer));
  if (valor && Object.getPrototypeOf(valor) === Object.prototype) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resolverColores(v, leer)]));
  }
  return valor;
}

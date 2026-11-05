// Eje de tiempo que comprime los periodos largos sin datos. Si un sensor midió 40 min
// en tres días distintos de un rango de 17 días, en un eje proporcional todo queda en
// franjas de pocos píxeles y las gráficas de área, barras y dispersión se ven iguales.
// Las fechas de las etiquetas y tooltips siguen siendo las reales.
import { DESFASE_MS, fechaCorta, fechaHora } from './formato.js';

// Un silencio mayor que esto se comprime; los más cortos conservan su proporción.
const UMBRAL_HUECO_MS = 2 * 3600 * 1000;
// Ancho de cada hueco comprimido, como fracción del tiempo que sí tiene datos.
const FRACCION_HUECO = 0.04;
const ANCHO_MINIMO_MS = 60 * 1000;

// Interpolación por tramos entre dos listas de puntos; fuera de ellas avanza 1 a 1.
function interpolar(valor, origen, destino) {
  const ultimo = origen.length - 1;
  if (valor <= origen[0]) return destino[0] + (valor - origen[0]);
  if (valor >= origen[ultimo]) return destino[ultimo] + (valor - origen[ultimo]);
  let i = 0;
  while (valor > origen[i + 1]) i += 1;
  const tramo = (valor - origen[i]) / (origen[i + 1] - origen[i]);
  return destino[i] + tramo * (destino[i + 1] - destino[i]);
}

function textoDuracion(ms) {
  const horas = Math.round(ms / (3600 * 1000));
  return horas < 24 ? `${horas} h` : `${Math.round(horas / 24)} d`;
}

export function crearEjeComprimido(lecturas) {
  const tiempos = [...new Set(
    Object.values(lecturas?.series ?? {})
      .flatMap((porNodo) => Object.values(porNodo).flat())
      .filter((p) => p[1] !== null)
      .map((p) => p[0]),
  )].sort((a, b) => a - b);

  const huecos = [];
  for (let i = 1; i < tiempos.length; i += 1) {
    if (tiempos[i] - tiempos[i - 1] > UMBRAL_HUECO_MS) huecos.push({ desde: tiempos[i - 1], hasta: tiempos[i] });
  }
  if (!huecos.length) {
    const aEje = (ts) => ts + DESFASE_MS;
    const deEje = (x) => x - DESFASE_MS;
    return { huecos, aEje, deEje, fechaDe: (x) => fechaHora(deEje(x)), etiqueta: null };
  }

  const total = tiempos[tiempos.length - 1] - tiempos[0];
  const silencio = huecos.reduce((suma, h) => suma + (h.hasta - h.desde), 0);
  const ancho = Math.max((total - silencio) * FRACCION_HUECO, ANCHO_MINIMO_MS);

  const reales = [tiempos[0]];
  const comprimidos = [tiempos[0]];
  for (const h of huecos) {
    comprimidos.push(comprimidos[comprimidos.length - 1] + (h.desde - reales[reales.length - 1]));
    reales.push(h.desde);
    comprimidos.push(comprimidos[comprimidos.length - 1] + ancho);
    reales.push(h.hasta);
  }
  reales.push(tiempos[tiempos.length - 1]);
  comprimidos.push(comprimidos[comprimidos.length - 1] + (reales[reales.length - 1] - reales[reales.length - 2]));

  const aEje = (ts) => interpolar(ts, reales, comprimidos) + DESFASE_MS;
  const deEje = (x) => interpolar(x - DESFASE_MS, comprimidos, reales);
  return {
    huecos: huecos.map((h) => ({ ...h, texto: textoDuracion(h.hasta - h.desde) })),
    aEje,
    deEje,
    fechaDe: (x) => fechaHora(deEje(x)),
    // Dentro de un hueco no hay una fecha útil que mostrar: la franja ya lo indica.
    etiqueta: (x) => {
      const real = deEje(x);
      return huecos.some((h) => real > h.desde && real < h.hasta) ? '' : fechaCorta(real);
    },
  };
}

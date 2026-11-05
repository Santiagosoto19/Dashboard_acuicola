// Gauge SVG de 240°. Las zonas se pintan exactamente según los límites de la variable.
// La aguja usa un resorte que escribe directo en el atributo transform: 60 fps sin
// pasar por el render de React.
import { useEffect, useId, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { zonasGauge } from '../lib/severidad';
import { RESORTE_AGUJA } from '../lib/movimiento';
import { C } from '../lib/colores';

const INICIO = 150;
const BARRIDO = 240;
const R = 78;
const CX = 100;
const CY = 100;

const polar = (grados, radio = R) => {
  const rad = (grados * Math.PI) / 180;
  return [CX + radio * Math.cos(rad), CY + radio * Math.sin(rad)];
};

function arco(desde, hasta) {
  const [x1, y1] = polar(desde);
  const [x2, y2] = polar(hasta);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// Cuenta hacia el valor nuevo escribiendo en el DOM, sin renders por cuadro.
export function ValorAnimado({ valor, decimales, className }) {
  const nodo = useRef(null);
  const previo = useRef(null);
  const reducido = useReducedMotion();
  useEffect(() => {
    if (valor === null || valor === undefined || !nodo.current) return undefined;
    const desde = previo.current ?? valor;
    previo.current = valor;
    if (reducido || desde === valor) {
      nodo.current.textContent = Number(valor).toFixed(decimales);
      return undefined;
    }
    const c = animate(desde, valor, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => { if (nodo.current) nodo.current.textContent = x.toFixed(decimales); },
    });
    return () => c.stop();
  }, [valor, decimales, reducido]);
  return <span ref={nodo} className={className}>{valor === null || valor === undefined ? '—' : Number(valor).toFixed(decimales)}</span>;
}

export default function Gauge({ variable, valor, margen = 0.1, grande = false, etiqueta }) {
  const idPatron = useId();
  const [a, b] = variable.escala;
  const sinDato = valor === null || valor === undefined;
  const aGrados = (x) => INICIO + ((Math.min(b, Math.max(a, x)) - a) / (b - a)) * BARRIDO;
  const objetivo = sinDato ? INICIO : aGrados(valor);

  const reducido = useReducedMotion();
  const base = useMotionValue(objetivo);
  const resorte = useSpring(base, RESORTE_AGUJA);
  const aguja = useRef(null);

  useEffect(() => {
    if (reducido) resorte.jump(objetivo);
    base.set(objetivo);
  }, [objetivo, base, resorte, reducido]);

  useEffect(() => {
    const pintar = (g) => aguja.current?.setAttribute('transform', `rotate(${g.toFixed(2)} ${CX} ${CY})`);
    pintar(resorte.get());
    return resorte.on('change', pintar);
  }, [resorte]);

  const zonas = zonasGauge(variable, margen);
  const grosor = grande ? 15 : 14;

  return (
    <svg viewBox="-16 0 232 170" className="block w-full" role="img" aria-label={etiqueta}>
      <defs>
        <pattern id={idPatron} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="var(--rayado-a)" />
          <rect width="3" height="8" fill="var(--rayado-b)" />
        </pattern>
      </defs>

      {sinDato ? (
        <path d={arco(INICIO, INICIO + BARRIDO)} fill="none" stroke={`url(#${idPatron})`} strokeWidth={grosor} />
      ) : zonas.map((z) => (
        <path
          key={`${z.desde}-${z.hasta}`}
          d={arco(aGrados(z.desde) + 0.7, aGrados(z.hasta) - 0.7)}
          fill="none"
          stroke={C[z.tono]}
          strokeWidth={grosor}
        />
      ))}

      {/* Marcas de los límites, con su valor: la zona se lee sin ir a la leyenda. */}
      {[variable.limite.min, variable.limite.max].filter((x) => x !== undefined).map((x) => {
        const g = aGrados(x);
        const [lx, ly] = polar(g, R + 15);
        return (
          <text key={x} x={lx} y={ly + 3} textAnchor={lx < 90 ? 'end' : lx > 110 ? 'start' : 'middle'} fontSize="9" fill={C.tinta2} fontWeight="550" className="num">{x}</text>
        );
      })}

      {!sinDato && (
        <g ref={aguja}>
          <line x1={CX + 6} y1={CY} x2={CX + R - 14} y2={CY} stroke={C.tinta} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={CX} cy={CY} r="7" fill={C.tinta} />
          <circle cx={CX} cy={CY} r="2.5" fill={C.superficie} />
        </g>
      )}

      <text x={CX - R + 4} y="165" fontSize="9" fill={C.tinta3} className="num">{a}</text>
      <text x={CX + R - 4} y="165" fontSize="9" fill={C.tinta3} textAnchor="end" className="num">{b}</text>
    </svg>
  );
}

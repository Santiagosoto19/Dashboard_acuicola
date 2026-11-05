// Tarjeta de una variable: gauge, sparkline, tendencia y estado con icono + texto.
import { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Equal, OctagonAlert, TriangleAlert,
} from 'lucide-react';
import Gauge, { ValorAnimado } from './Gauge';
import { C } from '../lib/colores';
import { fechaCorta, textoLimite, textoVariacion } from '../lib/formato';
import { ESTADO_VARIABLE, estadoDeValor, ludicoPermitido } from '../lib/severidad';

const ICONO_ESTADO = { fuera: OctagonAlert, cerca: TriangleAlert, dentro: CheckCircle2, antigua: Clock3, sin_dato: Clock3 };
const TINTA_ESTADO = {
  critica: 'text-critica-tinta', advertencia: 'text-advertencia-tinta', normal: 'text-normal-tinta', sin_dato: 'text-sin-dato-tinta',
};

function Sparkline({ historia, color, etiqueta }) {
  const id = useId();
  if (!historia || historia.length < 2) return <div className="h-10" aria-hidden />;
  const valores = historia.map((p) => p[1]);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const alto = 40;
  const ancho = 200;
  const paso = ancho / (historia.length - 1);
  const y = (v) => alto - 4 - ((v - min) / (max - min || 1)) * (alto - 10);
  const linea = historia.map((p, i) => `${i ? 'L' : 'M'}${(i * paso).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" className="h-10 w-full" role="img" aria-label={etiqueta}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linea} L${ancho} ${alto} L0 ${alto} Z`} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Tendencia({ lectura, decimales, jugar }) {
  const [chispas, setChispas] = useState(0);
  const [destello, setDestello] = useState(0);
  const tsPrevio = useRef(lectura?.ts);
  useEffect(() => {
    if (lectura?.ts && tsPrevio.current && lectura.ts !== tsPrevio.current) {
      setDestello((d) => d + 1);
      if (jugar) setChispas((c) => c + 1);
    }
    tsPrevio.current = lectura?.ts;
  }, [lectura?.ts, jugar]);

  const texto = textoVariacion(lectura, decimales);
  if (texto === null) return null;
  const v = lectura.variacion;
  const Icono = v > 0 ? ArrowUpRight : v < 0 ? ArrowDownRight : Equal;
  return (
    <span key={destello} className={`relative inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-suave px-2 py-0.5 text-xs font-semibold text-tinta-2 num ${destello ? 'destello' : ''}`} title="Variación respecto a la lectura anterior">
      <Icono aria-hidden className="size-3.5" strokeWidth={2.5} />
      {texto}
      {chispas > 0 && [[-14, -12], [12, -14], [18, 4], [-16, 6]].map(([dx, dy]) => (
        <i key={`${chispas}-${dx}`} className="chispa left-1/2 top-1/2" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` }} />
      ))}
    </span>
  );
}

export default function TarjetaVariable({ item, grande, margen, nivel, desactualizado, resaltada, alAbrir }) {
  const { variable: v, lectura, conocida, estado, nodo } = item;
  const info = ESTADO_VARIABLE[estado];
  const Icono = ICONO_ESTADO[estado];
  const sinDato = estado === 'sin_dato';
  const antigua = estado === 'antigua';
  const valor = antigua ? conocida.valor : lectura?.valor ?? null;
  const reducido = useReducedMotion();
  const jugar = ludicoPermitido({ nivel, desactualizado, movimientoReducido: reducido });

  // Sacudida corta si empeora; pequeño salto si mejora.
  const controles = useAnimationControls();
  const estadoPrevio = useRef(estado);
  useEffect(() => {
    const antes = ESTADO_VARIABLE[estadoPrevio.current].orden;
    const ahora = ESTADO_VARIABLE[estado].orden;
    estadoPrevio.current = estado;
    if (reducido || antes === ahora || antes >= 3 || ahora >= 3) return;
    if (ahora < antes) controles.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.38 } });
    else controles.start({ scale: [1, 1.025, 1], transition: { duration: 0.35 } });
  }, [estado, controles, reducido]);

  // Inclinación 3D sutil (máx. 6°) que sigue al cursor.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 300, damping: 30 });
  const rotateY = useSpring(ry, { stiffness: 300, damping: 30 });
  const mover = (e) => {
    if (reducido || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const salir = () => { rx.set(0); ry.set(0); };

  const brillo = { critica: 'rgba(225,29,72,.32)', advertencia: 'rgba(245,158,11,.36)', normal: 'rgba(22,163,74,.28)', sin_dato: 'rgba(148,163,184,.3)' }[info.tono];
  const colorSpark = { critica: C.critica, advertencia: C.advertencia, normal: C.normal, sin_dato: C.sin_dato }[info.tono];
  const etiquetaGauge = sinDato
    ? `${v.etiqueta}: sin lectura reciente`
    : `${v.etiqueta}: ${valor} ${v.unidad}, ${info.etiqueta.toLowerCase()}, límite ${textoLimite(v)}`;

  return (
    <motion.div
      id={`var-${v.clave}`}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`relative h-full ${grande ? 'md:col-span-2' : ''} ${resaltada ? 'resaltado' : ''}`}
      style={{ perspective: 900 }}
    >
      <motion.div animate={controles} className="h-full">
        <motion.button
          type="button"
          onClick={() => alAbrir(v.clave)}
          onPointerMove={mover}
          onPointerLeave={salir}
          style={{ rotateX, rotateY, '--brillo': brillo }}
          whileHover={reducido ? undefined : { y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          aria-label={`Ver detalle de ${v.etiqueta}`}
          className="group tarjeta relative flex h-full w-full cursor-pointer flex-col justify-start p-4 text-left"
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: '0 0 0 1.5px var(--brillo), 0 10px 26px -8px var(--brillo)' }} />

          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className={`font-semibold tracking-tight ${grande ? 'text-base' : 'text-sm'}`}>{v.etiqueta}</span>
            {lectura && <Tendencia lectura={lectura} decimales={v.decimales} jugar={jugar} />}
          </span>

          <span className={`grid items-center gap-x-5 ${grande ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
            <span className={`block ${desactualizado || antigua ? 'desaturado' : ''}`}>
              <Gauge variable={v} valor={valor} margen={margen} grande={grande} etiqueta={etiquetaGauge} />
            </span>

            <span className="block">
              <span className={`block text-center ${grande ? 'md:text-left' : ''} ${desactualizado || antigua ? 'desaturado' : ''} ${antigua ? 'text-tinta-2' : ''}`}>
                {sinDato ? (
                  <span className="block text-2xl font-bold text-tinta-3">Sin dato</span>
                ) : (
                  <span className={`block font-bold leading-none tracking-tight ${grande ? 'text-[40px]' : 'text-[32px]'}`}>
                    <ValorAnimado valor={valor} decimales={v.decimales} className="num" />
                    {v.unidad && <span className="ml-1 text-sm font-semibold text-tinta-2">{v.unidad}</span>}
                  </span>
                )}
              </span>

              <span className={`mt-2 flex items-center justify-center gap-1 text-xs font-semibold ${grande ? 'md:justify-start' : ''} ${TINTA_ESTADO[info.tono]}`}>
                <Icono aria-hidden className="size-3.5" strokeWidth={2.4} />
                {info.etiqueta}
              </span>
              <span className={`mt-0.5 block text-center text-xs text-tinta-2 ${grande ? 'md:text-left' : ''}`}>
                Límite {textoLimite(v)}{nodo ? ` · Nodo ${nodo}` : ''}
              </span>
              {antigua && (
                <span className={`mt-0.5 block text-center text-xs text-tinta-3 ${grande ? 'md:text-left' : ''}`}>
                  {`Del ${fechaCorta(conocida.ts)}${estadoDeValor(v, valor, margen) === 'fuera' ? ' · estaba fuera de límites' : ''}`}
                </span>
              )}
              {sinDato && (
                <span className="mt-0.5 block text-center text-xs text-tinta-3">Nunca ha reportado</span>
              )}
              {lectura && (
                <span className={`mt-2 block ${desactualizado ? 'desaturado' : ''}`}>
                  <Sparkline historia={lectura.historia} color={colorSpark} etiqueta={`Tendencia reciente de ${v.etiqueta}`} />
                </span>
              )}
            </span>
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

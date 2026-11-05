// Cabecera sticky de una línea: marca, pestañas y, al hacer scroll, el estado compacto.
// El hero sale de la vista al bajar; este resumen lo reemplaza para no perder el estado.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock3, Moon, Sun } from 'lucide-react';
import { NIVELES } from './Comunes';
import { fechaCorta, hace } from '../lib/formato';
import { RESORTE } from '../lib/movimiento';
import { alternarTema, useTema } from '../lib/tema';

const TONO_TEXTO = {
  normal: 'text-normal-tinta', advertencia: 'text-advertencia-tinta', critica: 'text-critica-tinta', sin_dato: 'text-sin-dato-tinta',
};

export const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'variables', etiqueta: 'Variables' },
  { id: 'alertas', etiqueta: 'Alertas' },
  { id: 'historico', etiqueta: 'Histórico' },
  { id: 'nodos', etiqueta: 'Nodos' },
];

function Pestanas({ activa, alCambiar }) {
  // Flechas para moverse entre pestañas, como pide el patrón ARIA de tabs.
  const teclado = (e) => {
    const i = PESTANAS.findIndex((p) => p.id === activa);
    const salto = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!salto) return;
    e.preventDefault();
    const siguiente = PESTANAS[(i + salto + PESTANAS.length) % PESTANAS.length];
    alCambiar(siguiente.id);
    document.getElementById(`tab-${siguiente.id}`)?.focus();
  };
  return (
    <nav role="tablist" aria-label="Secciones" onKeyDown={teclado} className="flex gap-0.5 overflow-x-auto">
      {PESTANAS.map((p) => {
        const sel = p.id === activa;
        return (
          <button
            key={p.id}
            id={`tab-${p.id}`}
            role="tab"
            type="button"
            aria-selected={sel}
            aria-controls={`panel-${p.id}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => alCambiar(p.id)}
            className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${sel ? 'text-tinta' : 'text-tinta-2 hover:text-tinta'}`}
          >
            {p.etiqueta}
            {sel && <motion.span layoutId="subrayado-pestana" transition={RESORTE} className="absolute inset-x-2 -bottom-px h-[3px] rounded-full" style={{ background: 'var(--degradado-marca)' }} />}
          </button>
        );
      })}
    </nav>
  );
}

function BotonTema() {
  const oscuro = useTema() === 'oscuro';
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  const Icono = oscuro ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-tinta-2 transition-colors hover:bg-suave hover:text-tinta"
    >
      <Icono aria-hidden className="size-[18px]" strokeWidth={2.2} />
    </button>
  );
}

export default function EstadoHeader({ estado, pestana, alCambiarPestana }) {
  const [compacto, setCompacto] = useState(false);
  const reducido = useReducedMotion();

  useEffect(() => {
    const medir = () => setCompacto(window.scrollY > 220);
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    return () => window.removeEventListener('scroll', medir);
  }, []);

  const n = NIVELES[estado?.nivel] ?? NIVELES.sin_datos;
  const obsoleto = estado?.desactualizado;

  return (
    <header className="vidrio sticky top-0 z-40 border-b border-borde">
      <div className="mx-auto flex min-h-14 max-w-[1440px] flex-wrap items-center gap-x-5 px-4 md:px-6">
        <a href="#resumen" onClick={() => alCambiarPestana('resumen')} className="flex items-center gap-2 py-3 text-[15px] font-bold tracking-tight">
          <svg aria-hidden viewBox="0 0 32 32" className="size-6"><path d="M3 16c5-8 14-9 20-3l6-4v14l-6-4c-6 6-15 5-20-3z" fill="#3B82F6" /><circle cx="11" cy="14" r="1.6" fill="#fff" /></svg>
          Estanque
        </a>

        <div className="order-3 w-full md:order-none md:w-auto"><Pestanas activa={pestana} alCambiar={alCambiarPestana} /></div>

        <div className="order-2 ml-auto flex min-w-0 items-center gap-3 md:order-none">
          <AnimatePresence>
            {compacto && estado && (
              <motion.p
                initial={reducido ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex min-w-0 items-center gap-1.5 text-sm font-semibold ${obsoleto ? 'text-sin-dato-tinta' : TONO_TEXTO[n.tono]}`}
              >
                {obsoleto ? <Clock3 aria-hidden className="size-4 shrink-0" strokeWidth={2.4} /> : <n.Icono aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />}
                {obsoleto ? `Desactualizado · último estado: ${n.etiqueta}` : n.etiqueta}
                <span className="hidden font-normal text-tinta-2 sm:inline num">· {fechaCorta(estado.ultimaMedicion)} ({hace(estado.ultimaMedicion)})</span>
              </motion.p>
            )}
          </AnimatePresence>
          <BotonTema />
        </div>
      </div>
    </header>
  );
}

// Efectos globales: fondo de agua, anillo de foco en degradado, burbujas y esqueletos.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PartyPopper } from 'lucide-react';

export function FondoAgua() {
  return <div className="mesh" aria-hidden><i /><i /><i /></div>;
}

// El navegador no permite degradados en outline. Este anillo sigue al elemento con
// foco de teclado, usando una máscara para dejar solo el borde.
export function AnilloFoco() {
  const [caja, setCaja] = useState(null);
  const objetivo = useRef(null);
  useEffect(() => {
    const medir = () => {
      const el = objetivo.current;
      if (!el) { setCaja(null); return; }
      const r = el.getBoundingClientRect();
      setCaja({ top: r.top - 3, left: r.left - 3, width: r.width + 6, height: r.height + 6 });
    };
    const entra = (e) => {
      objetivo.current = e.target.matches(':focus-visible') ? e.target : null;
      medir();
    };
    const sale = () => { objetivo.current = null; setCaja(null); };
    document.addEventListener('focusin', entra);
    document.addEventListener('focusout', sale);
    window.addEventListener('scroll', medir, { passive: true, capture: true });
    window.addEventListener('resize', medir);
    return () => {
      document.removeEventListener('focusin', entra);
      document.removeEventListener('focusout', sale);
      window.removeEventListener('scroll', medir, { capture: true });
      window.removeEventListener('resize', medir);
    };
  }, []);
  if (!caja) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed z-[70] rounded-[10px]"
      style={{
        ...caja,
        padding: 2.5,
        background: 'linear-gradient(100deg,#0891B2,#2563EB 55%,#7C3AED)',
        WebkitMask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
        mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
      }}
    />
  );
}

// Burbujas de celebración. Solo se montan si debeCelebrar() lo autoriza.
export function Burbujas({ activa, alTerminar }) {
  const [semillas] = useState(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: 4 + Math.random() * 92,
    t: 8 + Math.random() * 18,
    r: Math.random() * 0.7,
    d: 1.6 + Math.random() * 1.2,
  })));
  useEffect(() => {
    if (!activa) return undefined;
    const id = setTimeout(alTerminar, 3400);
    return () => clearTimeout(id);
  }, [activa, alTerminar]);
  return (
    <AnimatePresence>
      {activa && (
        <motion.div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" initial={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden>
          {semillas.map((s) => (
            <motion.i
              key={s.id}
              className="absolute bottom-0 block rounded-full border-2 border-cian/70 bg-cian/15"
              style={{ left: `${s.x}%`, width: s.t, height: s.t }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: '-105vh', opacity: [0, 1, 1, 0] }}
              transition={{ duration: s.d, delay: s.r, ease: 'easeIn' }}
            />
          ))}
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="vidrio absolute inset-x-0 bottom-8 mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-normal-tinta"
          >
            <PartyPopper aria-hidden className="size-4" /> El estanque volvió a Normal
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EsqueletoResumen() {
  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 p-4 md:grid-cols-12 md:p-6" aria-busy="true" aria-label="Cargando datos">
      <div className="esqueleto h-64 md:col-span-8" />
      <div className="esqueleto h-64 md:col-span-4" />
      <div className="esqueleto h-44 md:col-span-6" />
      <div className="esqueleto h-44 md:col-span-6" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="esqueleto h-80 md:col-span-3" />)}
    </div>
  );
}

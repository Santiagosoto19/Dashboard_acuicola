// Panel lateral con el detalle de una variable. Atrapa el foco, cierra con Esc y
// devuelve el foco a la tarjeta que lo abrió.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import GraficaVariable, { TIPOS_GRAFICA } from './GraficaVariable';
import { PastillaNivel, PillToggle } from './Comunes';
import { colorNodo } from '../lib/colores';
import { conUnidad, fechaHora, textoLimite } from '../lib/formato';
import { RESORTE } from '../lib/movimiento';

const ENFOCABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function DrawerDetalle({ clave, estado, lecturas, alertas, alCerrar }) {
  const variable = estado?.variables.find((v) => v.clave === clave);
  const panel = useRef(null);
  const origen = useRef(null);
  const [tipo, setTipo] = useState('area');
  const reducido = useReducedMotion();
  const abierto = Boolean(variable);

  useEffect(() => {
    if (!abierto) return undefined;
    origen.current = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    const teclado = (e) => {
      if (e.key === 'Escape') { alCerrar(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const lista = [...panel.current.querySelectorAll(ENFOCABLES)];
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', teclado);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', teclado);
      document.body.style.overflow = '';
      origen.current?.focus?.();
    };
  }, [abierto, alCerrar]);

  const stats = lecturas?.estadisticas?.[clave] ?? {};
  const eventos = (alertas?.recientes ?? []).filter((a) => a.variable === clave);

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <button type="button" tabIndex={-1} aria-label="Cerrar detalle" onClick={alCerrar} className="absolute inset-0 cursor-default bg-slate-900/25" />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-drawer"
            initial={reducido ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reducido ? { opacity: 0 } : { x: '100%' }}
            transition={RESORTE}
            className="vidrio absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-y-auto border-l border-borde bg-superficie/85 p-5 md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titulo-drawer" className="text-2xl font-bold tracking-tight">{variable.etiqueta}</h2>
                <p className="mt-0.5 text-sm text-tinta-2">Límite permitido: {textoLimite(variable)}</p>
              </div>
              <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-lg p-2 transition-colors hover:bg-suave"><X aria-hidden className="size-5" /></button>
            </div>

            <div className="mt-4"><PillToggle etiqueta="Tipo de gráfica" opciones={TIPOS_GRAFICA} valor={tipo} alCambiar={setTipo} /></div>
            <div className="mt-2"><GraficaVariable variable={variable} series={lecturas?.series?.[clave]} lecturas={lecturas} tipo={tipo} margen={estado.margenCerca} alto="h-80" /></div>

            <h3 className="mt-5 text-[15px] font-semibold">Estadísticas del rango</h3>
            {Object.keys(stats).length === 0 ? (
              <p className="mt-1 text-sm text-tinta-3">Sin lecturas en este rango.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left text-xs text-tinta-2"><th className="py-1 font-medium">Nodo</th><th className="py-1 text-right font-medium">Mín.</th><th className="py-1 text-right font-medium">Máx.</th><th className="py-1 text-right font-medium">Promedio</th><th className="py-1 text-right font-medium">Lecturas</th></tr></thead>
                <tbody>
                  {Object.entries(stats).map(([n, s]) => (
                    <tr key={n} className="border-t border-borde-2 num">
                      <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2 rounded-full" style={{ background: colorNodo(n) }} />Nodo {n}</span></td>
                      <td className="py-1.5 text-right">{conUnidad(variable, s.min)}</td>
                      <td className="py-1.5 text-right">{conUnidad(variable, s.max)}</td>
                      <td className="py-1.5 text-right">{conUnidad(variable, s.prom)}</td>
                      <td className="py-1.5 text-right">{s.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 className="mt-5 text-[15px] font-semibold">Eventos de alerta</h3>
            {eventos.length === 0 ? (
              <p className="mt-1 text-sm text-tinta-3">Sin alertas de esta variable en este rango.</p>
            ) : (
              <ul className="mt-2">
                {eventos.slice(0, 20).map((a) => (
                  <li key={`${a.ts}-${a.nodo}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde-2 py-1.5 text-sm">
                    <span className="num">{fechaHora(a.ts)} · Nodo {a.nodo}</span>
                    <span className="flex items-center gap-2 font-semibold num">{conUnidad(variable, a.valor)} <PastillaNivel nivel={a.severidad} /></span>
                  </li>
                ))}
              </ul>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

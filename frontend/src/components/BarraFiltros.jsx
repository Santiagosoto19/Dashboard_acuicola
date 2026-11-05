// Barra de filtros y acciones. Los selectores son nativos: en móvil y con teclado
// funcionan mejor que cualquier lista personalizada.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Download, RefreshCw, TriangleAlert } from 'lucide-react';
import { bogotaAMs, msABogota } from '../lib/formato';
import { calcularRango, consultaDe } from '../hooks/useTablero';
import { csvDemo } from '../lib/mock';

const CAMPO = 'h-9 max-w-full rounded-lg border border-borde-2 bg-superficie/80 px-2 text-sm text-tinta';
const BOTON = 'relative inline-flex h-9 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-borde-2 bg-superficie/80 px-3 text-sm font-semibold transition-colors hover:bg-superficie disabled:cursor-default';

function BotonRefrescar({ alRefrescar }) {
  const [fase, setFase] = useState('quieto');
  const reducido = useReducedMotion();
  const temporizador = useRef(null);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  const refrescar = async () => {
    setFase('cargando');
    const ok = await alRefrescar();
    setFase(ok === false ? 'error' : 'listo');
    temporizador.current = setTimeout(() => setFase('quieto'), 1600);
  };
  return (
    <button type="button" className={BOTON} onClick={refrescar} disabled={fase === 'cargando'} aria-live="polite">
      {fase === 'listo' ? <Check aria-hidden className="size-4 text-normal" strokeWidth={3} />
        : fase === 'error' ? <TriangleAlert aria-hidden className="size-4 text-critica" />
          : (
            <motion.span animate={fase === 'cargando' && !reducido ? { rotate: 360 } : { rotate: 0 }} transition={fase === 'cargando' ? { repeat: Infinity, ease: 'linear', duration: 0.8 } : { duration: 0 }} className="inline-flex">
              <RefreshCw aria-hidden className="size-4" />
            </motion.span>
          )}
      {fase === 'listo' ? 'Actualizado' : fase === 'error' ? 'Sin conexión' : 'Refrescar'}
    </button>
  );
}

// Descarga con progreso real: lee la respuesta por partes. Si no se conoce el tamaño,
// la barra avanza hasta 90 % y termina al completar.
function BotonCsv({ filtros, ultimaMedicion, demo }) {
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState(false);

  const guardar = (blob) => {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = demo ? 'demostracion_acuicola.csv' : 'mediciones_acuicola.csv';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 2000);
  };

  const descargar = async () => {
    setError(false);
    setProgreso(0.05);
    try {
      const consulta = consultaDe(filtros, ultimaMedicion);
      if (demo) {
        guardar(new Blob([csvDemo(demo, consulta)], { type: 'text/csv;charset=utf-8' }));
      } else {
        const r = await fetch(`/api/export.csv?${consulta}`);
        if (!r.ok) throw new Error(`Error ${r.status}`);
        const total = Number(r.headers.get('content-length')) || 0;
        const lector = r.body.getReader();
        const partes = [];
        let recibido = 0;
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          partes.push(value);
          recibido += value.length;
          setProgreso(total ? recibido / total : Math.min(0.9, recibido / 2e6));
        }
        guardar(new Blob(partes, { type: 'text/csv;charset=utf-8' }));
      }
      setProgreso(1);
      setTimeout(() => setProgreso(null), 500);
    } catch (err) {
      console.error('csv:', err.message);
      setProgreso(null);
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <button type="button" className={BOTON} onClick={descargar} disabled={progreso !== null}>
      {progreso !== null && (
        <motion.span aria-hidden className="absolute inset-0 origin-left opacity-20" style={{ background: 'var(--degradado-marca)' }} animate={{ scaleX: progreso }} initial={{ scaleX: 0 }} transition={{ duration: 0.2 }} />
      )}
      <Download aria-hidden className="relative size-4" />
      <span className="relative">{error ? 'No se pudo descargar' : progreso !== null ? 'Descargando…' : 'Descargar CSV'}</span>
    </button>
  );
}

export default function BarraFiltros({ estado, filtros, alCambiar, alRefrescar, demo, errorRango }) {
  const nodos = estado?.nodos ?? [];
  const [personal, setPersonal] = useState({ desde: '', hasta: '' });
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState(null);

  const elegirRango = (valor) => {
    if (valor === 'personalizado') {
      const { desde, hasta } = calcularRango(filtros, estado?.ultimaMedicion ?? null);
      setPersonal({ desde: msABogota(desde), hasta: msABogota(hasta) });
      setAbierto(true);
      return;
    }
    setAbierto(false);
    setAviso(null);
    alCambiar({ rango: valor });
  };

  const aplicar = () => {
    const desde = bogotaAMs(personal.desde);
    const hasta = bogotaAMs(personal.hasta);
    if (Number.isNaN(desde) || Number.isNaN(hasta)) { setAviso('Completa las dos fechas.'); return; }
    if (desde > hasta) { setAviso('La fecha inicial debe ser anterior a la final.'); return; }
    setAviso(null);
    alCambiar({ rango: 'personalizado', desde, hasta });
  };

  const mensaje = aviso ?? errorRango;

  return (
    <div className="vidrio z-30 border-b border-borde lg:sticky lg:top-14" role="toolbar" aria-label="Filtros">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end gap-x-3 gap-y-2 px-4 py-2.5 md:px-6">
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs font-medium text-tinta-2 sm:flex-none">
          Nodo
          <select className={CAMPO} value={filtros.nodo} onChange={(e) => alCambiar({ nodo: e.target.value })}>
            <option value="todos">Todos los nodos</option>
            {nodos.map((n) => <option key={n.nodo} value={String(n.nodo)}>Nodo {n.nodo}</option>)}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-tinta-2 sm:flex-none">
          Rango
          <select className={CAMPO} value={abierto ? 'personalizado' : filtros.rango} onChange={(e) => elegirRango(e.target.value)}>
            <option value="1h">Última 1 hora</option>
            <option value="6h">Últimas 6 horas</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="ultimos">24 h hasta la última medición</option>
            <option value="todo">Todo el historial (máx. 90 días)</option>
            <option value="personalizado">Personalizado…</option>
          </select>
        </label>

        <AnimatePresence>
          {abierto && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-tinta-2">Desde
                <input type="datetime-local" className={CAMPO} value={personal.desde} onChange={(e) => setPersonal((p) => ({ ...p, desde: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-tinta-2">Hasta
                <input type="datetime-local" className={CAMPO} value={personal.hasta} onChange={(e) => setPersonal((p) => ({ ...p, hasta: e.target.value }))} />
              </label>
              <button type="button" onClick={aplicar} className="h-9 rounded-lg px-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(100deg,#0E7490,#2563EB 55%,#6D28D9)' }}>Aplicar</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <span className="flex-1 sm:flex-none [&>button]:w-full"><BotonRefrescar alRefrescar={alRefrescar} /></span>
          <span className="flex-1 sm:flex-none [&>button]:w-full"><BotonCsv filtros={filtros} ultimaMedicion={estado?.ultimaMedicion ?? null} demo={demo} /></span>
        </div>
        {mensaje && <p role="alert" className="w-full text-xs font-semibold text-critica-tinta">{mensaje}</p>}
      </div>
    </div>
  );
}

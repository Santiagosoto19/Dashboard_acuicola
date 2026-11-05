// Composición principal. Los datos vienen del hook useTablero y bajan por props.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { FlaskConical, Info, ServerOff } from 'lucide-react';
import { useTablero } from './hooks/useTablero';
import EstadoHeader, { PESTANAS } from './components/EstadoHeader';
import BarraFiltros from './components/BarraFiltros';
import DrawerDetalle from './components/DrawerDetalle';
import { AnilloFoco, Burbujas, EsqueletoResumen, FondoAgua } from './components/Efectos';
import PanelResumen from './paneles/PanelResumen';
import PanelVariables from './paneles/PanelVariables';
import PanelAlertas from './paneles/PanelAlertas';
import PanelHistorico from './paneles/PanelHistorico';
import PanelNodos from './paneles/PanelNodos';
import { fechaHora } from './lib/formato';
import { debeCelebrar } from './lib/severidad';
import { ESCENARIOS } from './lib/mock';

const hashInicial = () => {
  const h = window.location.hash.slice(1);
  return PESTANAS.some((p) => p.id === h) ? h : 'resumen';
};

export default function App() {
  const t = useTablero();
  const { estado, lecturas, alertas, telemetria, red, filtros, demo } = t;
  const [pestana, setPestana] = useState(hashInicial);
  const [detalle, setDetalle] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [celebrando, setCelebrando] = useState(false);
  const reducido = useReducedMotion();
  const previo = useRef(null);
  const primeraVez = useRef(true);
  useEffect(() => { if (estado) primeraVez.current = false; }, [estado]);

  // Burbujas solo al pasar de un problema real a Normal, con datos en vivo.
  useEffect(() => {
    if (!estado) return;
    if (debeCelebrar(previo.current, estado, reducido)) setCelebrando(true);
    previo.current = { nivel: estado.nivel, desactualizado: estado.desactualizado };
  }, [estado, reducido]);
  // Si reaparece un problema durante la celebración, se corta de inmediato.
  useEffect(() => { if (celebrando && estado?.nivel !== 'normal') setCelebrando(false); }, [estado?.nivel, celebrando]);

  const cambiarPestana = useCallback((id) => {
    setPestana(id);
    try { window.history.replaceState(null, '', `${window.location.search}#${id}`); } catch { /* sin historial */ }
  }, []);

  // Chip del hero: lleva a la tarjeta de esa variable y la resalta.
  const irAVariable = useCallback((clave) => {
    cambiarPestana('resumen');
    setResaltada(clave);
    setTimeout(() => document.getElementById(`var-${clave}`)?.scrollIntoView({ block: 'center', behavior: reducido ? 'auto' : 'smooth' }), 50);
    setTimeout(() => setResaltada(null), 1800);
  }, [cambiarPestana, reducido]);

  const cerrarDetalle = useCallback(() => setDetalle(null), []);
  const terminarCelebracion = useCallback(() => setCelebrando(false), []);

  const nodosVisibles = useMemo(() => {
    const nodos = estado?.nodos ?? [];
    return filtros.nodo === 'todos' ? nodos : nodos.filter((n) => String(n.nodo) === filtros.nodo);
  }, [estado, filtros.nodo]);

  return (
    <MotionConfig reducedMotion="user">
      <FondoAgua />
      <AnilloFoco />
      <Burbujas activa={celebrando && estado?.nivel === 'normal'} alTerminar={terminarCelebracion} />

      {demo && (
        <p className="flex flex-wrap items-center justify-center gap-x-2 bg-violet-700 px-4 py-1.5 text-center text-xs font-semibold text-white">
          <FlaskConical aria-hidden className="size-3.5" /> Datos de demostración, no son mediciones reales. Escenario: {ESCENARIOS[demo].etiqueta}.
        </p>
      )}

      <EstadoHeader estado={estado} pestana={pestana} alCambiarPestana={cambiarPestana} />
      <BarraFiltros estado={estado} filtros={filtros} alCambiar={t.cambiarFiltros} alRefrescar={t.actualizar} demo={demo} errorRango={red.error} />

      {t.avisoSinRecientes && (
        <p className="mx-auto mt-4 flex max-w-[1408px] items-start gap-2 rounded-xl border border-borde-2 bg-superficie px-4 py-2.5 text-sm text-tinta-2 md:mx-6 min-[1488px]:mx-auto">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-azul" />
          No hay mediciones en las últimas 24 h. {filtros.rango === 'todo' ? 'Se muestra todo el historial hasta' : 'Se muestran las 24 h previas a'} la última medición ({fechaHora(estado.ultimaMedicion)}).
        </p>
      )}

      {!estado && red.servidorOk === null && <EsqueletoResumen />}

      {!estado && red.servidorOk === false && (
        <main className="mx-auto max-w-xl p-6">
          <section className="tarjeta p-6 text-center" role="alert">
            <ServerOff aria-hidden className="mx-auto size-8 text-critica" />
            <h1 className="mt-2 text-xl font-bold tracking-tight">No se puede consultar el servidor</h1>
            <p className="mt-1 text-tinta-2">Todavía no hay datos que mostrar. Se reintentará en 10 s; también puedes usar Refrescar.</p>
          </section>
        </main>
      )}

      {estado && (
        <main className="mx-auto max-w-[1440px] px-4 py-4 md:px-6 md:py-6">
          <div id={`panel-${pestana}`} role="tabpanel" aria-labelledby={`tab-${pestana}`}>
            {pestana === 'resumen' && (
              <PanelResumen
                estado={estado}
                nodosVisibles={nodosVisibles}
                lecturas={lecturas}
                alertas={alertas}
                red={red}
                primeraVez={primeraVez.current}
                varResaltada={resaltada}
                alElegirVariable={irAVariable}
                alAbrirVariable={setDetalle}
              />
            )}
            {pestana === 'variables' && <PanelVariables estado={estado} lecturas={lecturas} filtroNodo={filtros.nodo} />}
            {pestana === 'alertas' && <PanelAlertas estado={estado} lecturas={lecturas} alertas={alertas} />}
            {pestana === 'historico' && <PanelHistorico estado={estado} lecturas={lecturas} filtros={filtros} demo={demo} ciclo={red.ciclo} />}
            {pestana === 'nodos' && <PanelNodos estado={estado} nodosVisibles={nodosVisibles} telemetria={telemetria} filtroNodo={filtros.nodo} />}
          </div>
        </main>
      )}

      <DrawerDetalle clave={detalle} estado={estado} lecturas={lecturas} alertas={alertas} alCerrar={cerrarDetalle} />
    </MotionConfig>
  );
}

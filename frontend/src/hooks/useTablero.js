// Hook de datos: consulta la API cada 10 s y entrega todo por props a los componentes.
// Con ?demo=<escenario> usa datos simulados con la misma forma que la API.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ESCENARIOS, responderDemo } from '../lib/mock';

export const REFRESCO_MS = 10 * 1000;
const DIA_MS = 24 * 3600 * 1000;
// Igual que RANGO_MAX_DIAS del servidor: es lo máximo que acepta la API en una consulta.
const HISTORIAL_DIAS = 90;

const parametroDemo = () => {
  const d = new URLSearchParams(window.location.search).get('demo');
  return d && ESCENARIOS[d] ? d : null;
};

export function pedirDatos(ruta, demo) {
  if (demo) return Promise.resolve().then(() => responderDemo(demo, ruta));
  return fetch(ruta, { cache: 'no-store' }).then(async (r) => {
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) {
      const error = new Error(datos.error || `Error ${r.status}`);
      error.estado = r.status;
      throw error;
    }
    return datos;
  });
}

export function calcularRango(filtros, ultimaMedicion, ahora = Date.now()) {
  switch (filtros.rango) {
    case '1h': return { desde: ahora - 3600e3, hasta: ahora };
    case '6h': return { desde: ahora - 6 * 3600e3, hasta: ahora };
    case '7d': return { desde: ahora - 7 * DIA_MS, hasta: ahora };
    case 'ultimos': {
      const hasta = ultimaMedicion ?? ahora;
      return { desde: hasta - DIA_MS, hasta };
    }
    case 'todo': {
      const hasta = ultimaMedicion ?? ahora;
      return { desde: hasta - HISTORIAL_DIAS * DIA_MS, hasta };
    }
    case 'personalizado': return { desde: filtros.desde, hasta: filtros.hasta };
    default: return { desde: ahora - DIA_MS, hasta: ahora };
  }
}

export function consultaDe(filtros, ultimaMedicion, extra = {}) {
  const { desde, hasta } = calcularRango(filtros, ultimaMedicion);
  const p = new URLSearchParams({ desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString(), ...extra });
  if (filtros.nodo !== 'todos') p.set('nodos', filtros.nodo);
  return p.toString();
}

export function useTablero() {
  const demo = useMemo(parametroDemo, []);
  const [filtros, setFiltros] = useState({ nodo: 'todos', rango: '24h', desde: null, hasta: null });
  const [datos, setDatos] = useState({ estado: null, lecturas: null, alertas: null, telemetria: null });
  const [red, setRed] = useState({ servidorOk: null, cargando: true, error: null, actualizado: null, ciclo: 0 });
  const secuencia = useRef(0);
  const filtrosRef = useRef(filtros);
  const rangoElegido = useRef(false);
  filtrosRef.current = filtros;

  const actualizar = useCallback(async () => {
    const turno = ++secuencia.current;
    setRed((r) => ({ ...r, cargando: true }));
    let ok = true;
    let errorRango = null;
    let estado = null;
    try {
      estado = await pedirDatos('/api/estado', demo);
    } catch (err) {
      ok = false;
      console.error('estado:', err.message);
    }
    if (turno !== secuencia.current) return;

    // Sin datos recientes, las últimas 24 h quedarían vacías. La primera vez se pasa
    // a todo el historial, para incluir variables que dejaron de reportar antes que
    // las demás, y un aviso lo deja claro.
    let vigentes = filtrosRef.current;
    if (estado && !rangoElegido.current && vigentes.rango === '24h' && estado.ultimaMedicion && Date.now() - estado.ultimaMedicion >= DIA_MS) {
      rangoElegido.current = true;
      vigentes = { ...vigentes, rango: 'todo' };
      filtrosRef.current = vigentes;
      setFiltros(vigentes);
    }

    const consulta = consultaDe(vigentes, estado?.ultimaMedicion ?? null);
    const [lecturas, alertas, telemetria] = await Promise.allSettled([
      pedirDatos(`/api/lecturas?${consulta}`, demo),
      pedirDatos(`/api/alertas?${consulta}`, demo),
      pedirDatos('/api/nodos', demo),
    ]);
    if (turno !== secuencia.current) return;

    for (const r of [lecturas, alertas, telemetria]) {
      if (r.status !== 'rejected') continue;
      // Un error 400 es un rango inválido, no una caída de la conexión.
      if (r.reason.estado === 400) errorRango = r.reason.message;
      else ok = false;
      console.error(r.reason.message);
    }

    setDatos((d) => ({
      estado: estado ?? d.estado,
      lecturas: lecturas.status === 'fulfilled' ? lecturas.value : d.lecturas,
      alertas: alertas.status === 'fulfilled' ? alertas.value : d.alertas,
      telemetria: telemetria.status === 'fulfilled' ? telemetria.value : d.telemetria,
    }));
    setRed((r) => ({
      servidorOk: ok,
      cargando: false,
      error: errorRango,
      actualizado: ok ? Date.now() : r.actualizado,
      ciclo: r.ciclo + 1,
    }));
    return ok;
  }, [demo]);

  // Refresca al montar, cada 10 s (si la pestaña está visible) y al cambiar filtros.
  const claveFiltros = `${filtros.nodo}|${filtros.rango}|${filtros.desde}|${filtros.hasta}`;
  useEffect(() => {
    actualizar();
    const id = setInterval(() => { if (!document.hidden) actualizar(); }, REFRESCO_MS);
    return () => clearInterval(id);
  }, [actualizar, claveFiltros]);

  const cambiarFiltros = useCallback((cambio) => {
    if (cambio.rango) rangoElegido.current = true;
    setFiltros((f) => ({ ...f, ...cambio }));
  }, []);

  const avisoSinRecientes = ['ultimos', 'todo'].includes(filtros.rango) && datos.estado?.ultimaMedicion
    && Date.now() - datos.estado.ultimaMedicion >= DIA_MS;

  return { demo, filtros, cambiarFiltros, ...datos, red, actualizar, avisoSinRecientes };
}

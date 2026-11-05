// Contenedor de ECharts. Crea la instancia una vez y solo le pasa datos nuevos: así
// los cambios de filtro hacen transición en vez de volver a montar la gráfica.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { echarts } from '../lib/echarts';
import { C, resolverColores } from '../lib/colores';
import { useTema } from '../lib/tema';

export default function Lienzo({
  opcion, vacio = false, mensaje = 'Sin datos en este rango', grupo, alto = 'h-72', eventos, etiqueta, reemplazar = ['series'],
}) {
  const nodo = useRef(null);
  const instancia = useRef(null);
  const reducido = useReducedMotion();
  const tema = useTema();

  useEffect(() => {
    const chart = echarts.init(nodo.current, null, { locale: 'ES' });
    instancia.current = chart;
    if (grupo) {
      chart.group = grupo;
      echarts.connect(grupo);
    }
    // Solo si el tamaño cambió de verdad: el primer aviso del observador llega sin
    // cambios y un resize ahí cancelaría la animación de entrada a medio camino.
    const observador = new ResizeObserver(() => {
      const { clientWidth: ancho, clientHeight: alto2 } = nodo.current ?? {};
      if (ancho && (ancho !== chart.getWidth() || alto2 !== chart.getHeight())) chart.resize();
    });
    observador.observe(nodo.current);
    return () => {
      observador.disconnect();
      chart.dispose();
    };
  }, [grupo]);

  useEffect(() => {
    if (vacio || !opcion) return;
    const estilos = getComputedStyle(document.documentElement);
    instancia.current.setOption(resolverColores({
      // useUTC va aquí, no en init: los tiempos ya vienen desplazados a hora de Bogotá.
      useUTC: true,
      animation: !reducido,
      animationDuration: 500,
      animationDurationUpdate: 450,
      backgroundColor: 'transparent',
      textStyle: { color: C.tinta2, fontFamily: 'Inter Variable, system-ui, sans-serif' },
      ...opcion,
    }, (nombre) => estilos.getPropertyValue(nombre).trim()), { replaceMerge: reemplazar });
  }, [opcion, vacio, reducido, reemplazar, tema]);

  useEffect(() => {
    const chart = instancia.current;
    if (!eventos) return undefined;
    for (const [nombre, fn] of Object.entries(eventos)) chart.on(nombre, (p) => fn(p, chart));
    return () => { for (const nombre of Object.keys(eventos)) chart.off(nombre); };
  }, [eventos]);

  return (
    <div className={`relative ${alto}`} role="img" aria-label={etiqueta}>
      <div ref={nodo} className="absolute inset-0" style={{ visibility: vacio ? 'hidden' : 'visible' }} />
      {vacio && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-tinta-3">{mensaje}</div>
      )}
    </div>
  );
}

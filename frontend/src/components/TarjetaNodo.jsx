// Tarjeta de un nodo: color de identidad, severidad, conexión y variables con su delta.
import { ArrowDownRight, ArrowUpRight, Equal, OctagonAlert } from 'lucide-react';
import { PastillaConexion, PastillaNivel } from './Comunes';
import { colorNodo } from '../lib/colores';
import { conUnidad, fechaCorta, fechaHora, hace, textoVariacion } from '../lib/formato';

export default function TarjetaNodo({ nodo, variables, desactualizado, elevacion = 'base' }) {
  const vigentes = variables.filter((v) => nodo.lecturas[v.clave]?.vigente);
  // Lo que este nodo reportó antes y ya no envía: valor y fecha, sin marcarlo como alerta.
  const antiguas = variables.filter((v) => !nodo.lecturas[v.clave]?.vigente && nodo.conocidas?.[v.clave]);
  return (
    <article
      className="tarjeta relative min-w-0 overflow-hidden p-4 md:p-5"
      style={elevacion === 'alta' ? { boxShadow: 'var(--shadow-alta)', zIndex: 1 } : undefined}
      aria-label={`Nodo ${nodo.nodo}`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: colorNodo(nodo.nodo) }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: colorNodo(nodo.nodo) }} />
          Nodo {nodo.nodo}
          {nodo.referencia && <span className="text-xs font-normal text-tinta-3">{nodo.referencia}</span>}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <PastillaNivel nivel={nodo.nivel} />
          <PastillaConexion conexion={nodo.conexion} />
        </div>
      </div>
      <p className="mt-1 text-xs text-tinta-2 num">
        {nodo.ultimaHora ? `${fechaHora(nodo.ultimaHora)} · ${hace(nodo.ultimaHora)}` : 'Sin mediciones'}
      </p>

      <ul className={`mt-3 ${desactualizado ? 'desaturado' : ''}`}>
        {vigentes.length === 0 && antiguas.length === 0 && <li className="py-2 text-sm text-tinta-3">Sin lecturas recientes</li>}
        {vigentes.map((v) => {
          const l = nodo.lecturas[v.clave];
          const Icono = l.variacion > 0 ? ArrowUpRight : l.variacion < 0 ? ArrowDownRight : Equal;
          const delta = textoVariacion(l, v.decimales);
          return (
            <li key={v.clave} className="grid grid-cols-[1fr_auto_6.5rem] items-center gap-3 border-t border-borde-2 py-2 first:border-t-0">
              <span className="text-tinta-2">{v.etiqueta}</span>
              <span className={`flex items-center gap-1 text-[15px] font-semibold num ${l.anormal ? 'text-critica-tinta' : ''}`}>
                {l.anormal && <><OctagonAlert aria-hidden className="size-4" strokeWidth={2.4} /><span className="sr-only">Fuera de límites:</span></>}
                {conUnidad(v, l.valor)}
              </span>
              <span className="flex items-center justify-end gap-0.5 text-xs text-tinta-2 num" title="Variación respecto a la lectura anterior">
                {delta === null ? 'sin previa' : <><Icono aria-hidden className="size-3.5" strokeWidth={2.4} />{delta}</>}
              </span>
            </li>
          );
        })}
        {antiguas.map((v) => (
          <li key={v.clave} className="grid grid-cols-[1fr_auto_6.5rem] items-center gap-3 border-t border-borde-2 py-2 text-tinta-3 first:border-t-0">
            <span>{v.etiqueta}</span>
            <span className="text-[15px] font-semibold num">{conUnidad(v, nodo.conocidas[v.clave].valor)}</span>
            <span className="text-right text-xs num" title="Lectura antigua: no cuenta para el estado actual">{fechaCorta(nodo.conocidas[v.clave].ts)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

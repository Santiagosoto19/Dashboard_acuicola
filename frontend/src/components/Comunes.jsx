// Piezas pequeñas compartidas: estado con icono + texto, tarjetas y selector tipo pill.
import { useId } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2, CircleHelp, Clock3, OctagonAlert, TriangleAlert, WifiOff, Wifi,
} from 'lucide-react';
import { RESORTE } from '../lib/movimiento';

export const NIVELES = {
  normal: { etiqueta: 'Normal', Icono: CheckCircle2, tono: 'normal' },
  advertencia: { etiqueta: 'Advertencia', Icono: TriangleAlert, tono: 'advertencia' },
  critica: { etiqueta: 'Crítica', Icono: OctagonAlert, tono: 'critica' },
  sin_datos: { etiqueta: 'Sin datos', Icono: CircleHelp, tono: 'sin_dato' },
};

const CLASES_TONO = {
  normal: 'bg-normal-suave text-normal-tinta',
  advertencia: 'bg-advertencia-suave text-advertencia-tinta',
  critica: 'bg-critica-suave text-critica-tinta',
  sin_dato: 'bg-sin-dato-suave text-sin-dato-tinta',
};

export function Pastilla({ tono = 'sin_dato', Icono, children, rayada = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CLASES_TONO[tono]} ${rayada ? 'rayado' : ''} ${className}`}>
      {Icono && <Icono aria-hidden className="size-3.5 shrink-0" strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export function PastillaNivel({ nivel }) {
  const n = NIVELES[nivel] ?? NIVELES.sin_datos;
  return <Pastilla tono={n.tono} Icono={n.Icono}>{n.etiqueta}</Pastilla>;
}

export function PastillaConexion({ conexion }) {
  return conexion === 'en_linea'
    ? <Pastilla tono="normal" Icono={Wifi}>En línea</Pastilla>
    : <Pastilla tono="sin_dato" Icono={WifiOff} rayada>Sin comunicación</Pastilla>;
}

export function PastillaObsoleta({ children }) {
  return <Pastilla tono="sin_dato" Icono={Clock3}>{children}</Pastilla>;
}

export function Tarjeta({ titulo, nota, acciones, children, className = '' }) {
  return (
    <section className={`tarjeta min-w-0 p-4 md:p-5 ${className}`}>
      {(titulo || acciones) && (
        <header className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {titulo && <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>}
            {nota && <p className="mt-0.5 text-xs text-tinta-3">{nota}</p>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

// Pill con indicador deslizante (spring). Sirve para el tipo de gráfica.
export function PillToggle({ opciones, valor, alCambiar, etiqueta }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-full bg-suave p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => alCambiar(o.valor)}
          className={`relative rounded-full px-3 py-1 text-xs font-semibold transition-colors ${valor === o.valor ? 'text-white' : 'text-tinta-2 hover:text-tinta'}`}
        >
          {valor === o.valor && (
            <motion.span layoutId={`pill-${id}`} transition={RESORTE} className="absolute inset-0 rounded-full" style={{ background: 'var(--degradado-marca)' }} />
          )}
          <span className="relative">{o.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}

export function SelectorVariable({ variables, valor, alCambiar, etiqueta }) {
  return (
    <label className="inline-flex flex-col gap-1 text-xs font-medium text-tinta-2">
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="h-9 rounded-lg border border-borde-2 bg-superficie px-2 text-sm text-tinta"
      >
        {variables.map((v) => <option key={v.clave} value={v.clave}>{v.etiqueta}</option>)}
      </select>
    </label>
  );
}

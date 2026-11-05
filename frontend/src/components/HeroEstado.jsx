// Hero: responde "¿tengo que actuar?" en menos de 3 segundos.
// Regla central: si los datos están viejos, lo primero que se lee es eso, no "Crítica".
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Award, Clock3, Radio, Server, ServerOff } from 'lucide-react';
import { NIVELES, PastillaNivel } from './Comunes';
import { fechaHora, hace } from '../lib/formato';
import { REFRESCO_MS } from '../hooks/useTablero';

// Cuenta regresiva: un punto orbita la pista usando solo rotación.
function ContadorRefresco({ ciclo, cargando }) {
  const [segundos, setSegundos] = useState(10);
  const reducido = useReducedMotion();
  useEffect(() => {
    const inicio = Date.now();
    setSegundos(10);
    const id = setInterval(() => {
      setSegundos(Math.max(0, Math.ceil((REFRESCO_MS - (Date.now() - inicio)) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [ciclo]);
  return (
    <span className="relative inline-flex size-10 shrink-0 items-center justify-center" role="timer" aria-label={`Próximo refresco en ${segundos} segundos`}>
      <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0">
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--color-borde-2)" strokeWidth="3" />
      </svg>
      {!reducido && (
        <span key={ciclo} aria-hidden className="orbita absolute inset-0">
          <i className="absolute left-1/2 top-[1.5px] size-[6px] -translate-x-1/2 rounded-full" style={{ background: 'var(--degradado-marca)' }} />
        </span>
      )}
      <span className="text-xs font-semibold num">{cargando ? '…' : segundos}</span>
    </span>
  );
}

function DatoConexion({ Icono, titulo, valor, detalle, tono }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icono aria-hidden className={`mt-0.5 size-4 shrink-0 ${tono}`} strokeWidth={2.2} />
      <div className="min-w-0">
        <p className="text-xs text-tinta-2">{titulo}</p>
        <p className={`text-sm font-semibold ${tono}`}>{valor}</p>
        {detalle && <p className="text-xs text-tinta-2 num">{detalle}</p>}
      </div>
    </div>
  );
}

export default function HeroEstado({ estado, servidorOk, actualizado, ciclo, cargando, alElegirVariable }) {
  const n = NIVELES[estado.nivel] ?? NIVELES.sin_datos;
  const { Icono } = n;
  const obsoleto = estado.desactualizado && estado.nivel !== 'sin_datos';
  const tono = obsoleto ? 'sin_dato' : n.tono;
  const fuera = estado.nodos.flatMap((nodo) => nodo.anormales.map((clave) => ({
    clave, nodo: nodo.nodo, etiqueta: estado.variables.find((v) => v.clave === clave)?.etiqueta ?? clave,
  })));
  const totalNodos = estado.nodos.length;
  const tonoIcono = { normal: 'text-normal', advertencia: 'text-advertencia', critica: 'text-critica', sin_dato: 'text-sin-dato-tinta' }[tono];

  return (
    <section className="tarjeta hero flex h-full flex-col p-5 md:p-6" data-tono={tono} aria-label="Estado general del estanque" aria-live="polite">
      {tono === 'critica' && <span aria-hidden className="hero__pulso" />}

      {obsoleto && (
        <div className="relative mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-aviso px-3 py-2.5 text-sm font-semibold text-white">
          <Clock3 aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
          Datos desactualizados · {hace(estado.ultimaMedicion)}
          <span className="font-normal text-slate-300">Esto no describe el estanque de ahora.</span>
        </div>
      )}

      <div className="relative flex items-start gap-3">
        <motion.span key={estado.nivel} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={obsoleto ? 'desaturado' : ''}>
          <Icono aria-hidden className={`${obsoleto ? 'size-8' : 'size-11'} ${tonoIcono}`} strokeWidth={2.2} />
        </motion.span>
        <div className="min-w-0">
          {obsoleto ? (
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">Último estado conocido <PastillaNivel nivel={estado.nivel} /></h1>
          ) : (
            <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight">{n.etiqueta}</h1>
          )}
          <p className="mt-1 text-sm text-tinta-2">
            {estado.nivel === 'normal' && 'Todas las variables están dentro de los límites.'}
            {estado.nivel === 'sin_datos' && 'Aún no hay mediciones registradas.'}
            {fuera.length > 0 && (obsoleto ? 'Estaban fuera de límites:' : 'Fuera de límites:')}
          </p>
        </div>
      </div>

      {fuera.length > 0 && (
        <ul className="relative mt-3 flex flex-wrap gap-2">
          {fuera.map((f) => (
            <li key={`${f.clave}-${f.nodo}`}>
              <button
                type="button"
                onClick={() => alElegirVariable(f.clave)}
                className="inline-flex items-center gap-1.5 rounded-full border border-borde-2 bg-superficie px-3 py-1 text-sm font-semibold transition-transform hover:-translate-y-0.5"
              >
                {f.etiqueta}
                <span className="font-normal text-tinta-2">nodo {f.nodo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {estado.racha24h && (
        <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--logro-fondo)] px-3 py-1 text-sm font-semibold text-normal-tinta">
          <Award aria-hidden className="size-4" strokeWidth={2.4} /> 24 h sin alertas
        </p>
      )}

      <div aria-hidden className="min-h-5 flex-1" />
      <div className="relative mt-auto grid grid-cols-1 gap-4 border-t border-borde-2 pt-4 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
        <DatoConexion
          Icono={Clock3}
          titulo="Última medición (hora de Bogotá)"
          valor={<span className="num">{fechaHora(estado.ultimaMedicion)}</span>}
          detalle={hace(estado.ultimaMedicion)}
          tono="text-tinta"
        />
        {/* "Servidor" y "nodos" son hechos distintos: el servidor puede responder con todos los nodos apagados. */}
        <DatoConexion
          Icono={servidorOk === false ? ServerOff : Server}
          titulo="Servidor"
          valor={servidorOk === false ? 'Sin conexión' : 'Conectado'}
          detalle={servidorOk === false ? 'Se muestran los últimos datos recibidos' : actualizado ? `Consultado ${new Date(actualizado).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false })}` : ''}
          tono={servidorOk === false ? 'text-critica-tinta' : 'text-normal-tinta'}
        />
        <DatoConexion
          Icono={Radio}
          titulo="Nodos"
          valor={`${estado.nodosReportando} de ${totalNodos} reportando`}
          detalle={estado.nodosReportando === totalNodos ? 'Enviando cada 30 s' : 'Sin comunicación tras 90 s'}
          tono={estado.nodosReportando === totalNodos ? 'text-normal-tinta' : 'text-sin-dato-tinta'}
        />
        <div className="flex items-center gap-2">
          <ContadorRefresco ciclo={ciclo} cargando={cargando} />
          <span className="text-xs text-tinta-2 sm:hidden">Actualiza cada 10 s</span>
        </div>
      </div>
    </section>
  );
}

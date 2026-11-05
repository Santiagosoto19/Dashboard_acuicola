// Nodos: telemetría y tarjetas de estado.
import TarjetaNodo from '../components/TarjetaNodo';
import { PastillaConexion, Tarjeta } from '../components/Comunes';
import { colorNodo } from '../lib/colores';
import { fechaHora, hace } from '../lib/formato';
import { TD, TH } from './PanelAlertas';

export default function PanelNodos({ estado, nodosVisibles, telemetria, filtroNodo }) {
  const filas = (telemetria?.nodos ?? []).filter((n) => filtroNodo === 'todos' || String(n.nodo) === filtroNodo);
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Telemetría de nodos" nota={telemetria ? `Sin comunicación: sin datos hace más de ${telemetria.limiteSinComunicacionSeg} s (3 intervalos). Totales de todo el historial.` : ''}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className={TH}>Nodo</th><th className={TH}>Referencia</th><th className={TH}>Rol</th><th className={TH}>Conexión</th><th className={TH}>Último paquete</th><th className={`${TH} text-right`}>Mensajes</th><th className={`${TH} text-right`}>Lecturas</th></tr></thead>
            <tbody>
              {filas.map((n) => (
                <tr key={n.nodo}>
                  <td className={TD}><span className="inline-flex items-center gap-1.5"><i aria-hidden className="size-2.5 rounded-full" style={{ background: colorNodo(n.nodo) }} />Nodo {n.nodo}</span></td>
                  <td className={TD}>{n.referencia ?? '—'}</td>
                  <td className={TD}>{(n.rol ?? '—').replace('_', ' ')}</td>
                  <td className={TD}><PastillaConexion conexion={n.conexion} /></td>
                  <td className={`${TD} num`}>{fechaHora(n.ultimoPaquete)} <span className="text-tinta-3">· {hace(n.ultimoPaquete)}</span></td>
                  <td className={`${TD} text-right num`}>{n.mensajes}</td>
                  <td className={`${TD} text-right num`}>{n.totalLecturas}</td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-tinta-3">Sin nodos registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </Tarjeta>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {nodosVisibles.map((n) => <TarjetaNodo key={n.nodo} nodo={n} variables={estado.variables} desactualizado={estado.desactualizado} />)}
      </div>
    </div>
  );
}

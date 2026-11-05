// Mascota: un pez en su pecera que refleja el estado del estanque.
// El agua usa datos reales: la altura sigue al nivel y la turbiedad al NTU.
import { useId } from 'react';
import { CheckCircle2, CircleOff, OctagonAlert, TriangleAlert } from 'lucide-react';
import { animoMascota, opacidadTurbidez } from '../lib/severidad';

const ANCHO = 420;
const ALTO = 200;
const FONDO = 182; // línea de arena
const ANIMOS = {
  normal: { Icono: CheckCircle2, color: 'text-normal-tinta', texto: 'Nada tranquilo. Agua en orden.', vel: '13s', cola: '0.45s' },
  advertencia: { Icono: TriangleAlert, color: 'text-advertencia-tinta', texto: 'Nada lento y preocupado. Revisa la variable fuera de límites.', vel: '26s', cola: '0.9s' },
  critica: { Icono: OctagonAlert, color: 'text-critica-tinta', texto: 'Jadea en la superficie. Requiere atención.', vel: '0s', cola: '1.2s' },
  sin_comunicacion: { Icono: CircleOff, color: 'text-sin-dato-tinta', texto: 'Señal perdida. No sabemos cómo está el agua ahora.', vel: '0s', cola: '0s' },
};

// Ola repetible: dos periodos para poder desplazarla sin que se note el corte.
function ola(y) {
  let d = `M -160 ${y}`;
  for (let x = -160; x < ANCHO + 320; x += 80) d += ` q 40 ${x % 160 === 0 ? -7 : 7} 80 0`;
  return `${d} V ${ALTO} H -160 Z`;
}

function Pez({ animo }) {
  const dormido = animo === 'sin_comunicacion';
  const jadea = animo === 'critica';
  const preocupado = animo === 'advertencia';
  return (
    <g>
      {/* Cola */}
      <path className={dormido ? '' : 'm-cola'} d="M -33 0 L -56 -15 Q -50 0 -56 15 Z" fill="#2563EB" />
      {/* Cuerpo */}
      <path d="M -36 0 C -24 -24 20 -26 38 -3 C 40 0 40 2 38 5 C 20 26 -24 24 -36 0 Z" fill="url(#pez-cuerpo)" />
      {/* Vientre y aletas */}
      <path d="M -24 8 C -8 20 20 20 34 6 C 18 12 -6 13 -24 8 Z" fill="#BAE6FD" opacity="0.8" />
      <path d="M -6 -19 Q 4 -36 18 -18 Z" fill="#2563EB" />
      <path d="M 0 10 Q 6 24 16 13 Z" fill="#1D4ED8" opacity="0.85" />
      {/* Ojo */}
      {dormido ? (
        <path d="M 16 -6 q 5 4 10 0" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <g>
          <circle cx="21" cy="-6" r={jadea ? 7.5 : 6} fill="#fff" />
          <circle cx={jadea ? 22 : 23} cy={preocupado ? -4.5 : -6} r={jadea ? 3 : 3.2} fill="#0F172A" />
        </g>
      )}
      {/* Ceja de preocupación */}
      {preocupado && <path d="M 14 -14 L 27 -11" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />}
      {/* Boca */}
      {jadea
        ? <ellipse className="m-boca" cx="34" cy="4" rx="4.5" ry="6" fill="#7F1D1D" />
        : preocupado
          ? <path d="M 27 7 q 5 -4 9 0" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          : !dormido && <path d="M 28 6 q 4 4 9 0" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />}
    </g>
  );
}

export default function Mascota({ estado, turbidez, nivelCm, temperatura, limiteTemp }) {
  const idRecorte = useId();
  const idRuido = useId();
  const animo = animoMascota(estado);
  const info = ANIMOS[animo];
  const { Icono } = info;

  // Altura del agua: 100 cm llenan la pecera. Sin dato de nivel, se dibuja a 70 %
  // y el texto lo aclara, para no inventar una medición.
  const nivelReal = nivelCm ?? 70;
  const superficie = FONDO - (Math.max(25, Math.min(100, nivelReal)) / 100) * (FONDO - 18);
  const yPez = animo === 'critica' ? superficie + 26 : Math.max(superficie + 44, 104);
  const fueraTemp = temperatura != null && ((limiteTemp.min !== undefined && temperatura < limiteTemp.min) || (limiteTemp.max !== undefined && temperatura > limiteTemp.max));
  const dormido = animo === 'sin_comunicacion';

  const descripcion = `Pecera. ${info.texto}${nivelCm != null ? ` Nivel de agua ${nivelCm.toFixed(0)} centímetros.` : ''}${turbidez != null ? ` Turbidez ${turbidez.toFixed(0)} NTU.` : ''}`;

  return (
    <section className="tarjeta flex h-full min-w-0 flex-col overflow-hidden" aria-label="Mascota del estanque">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="pecera" role="img" aria-label={descripcion}>
        <defs>
          <clipPath id={idRecorte}><rect x="0" y="0" width={ANCHO} height={ALTO} /></clipPath>
          <linearGradient id="agua-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#67E8F9" stopOpacity="0.62" />
            <stop offset="1" stopColor="#3B82F6" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="pez-cuerpo" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
          <filter id={idRuido} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        <g clipPath={`url(#${idRecorte})`}>
          <rect width={ANCHO} height={ALTO} fill="var(--pecera-cielo)" />

          {/* Agua: dos capas de ola */}
          <g className="m-ola m-ola--2"><path d={ola(superficie + 3)} fill="#A5F3FC" opacity="0.5" /></g>
          <g className="m-ola"><path d={ola(superficie)} fill="url(#agua-grad)" /></g>

          {/* Arena y algas */}
          <path d={`M 0 ${FONDO} Q 80 ${FONDO - 7} 160 ${FONDO - 1} T 420 ${FONDO - 3} V 200 H 0 Z`} fill="var(--pecera-arena)" />
          <g className="m-alga"><path d="M 44 186 C 36 160 54 150 44 122 C 58 146 50 164 54 186 Z" fill="#15803D" /></g>
          <g className="m-alga" style={{ animationDelay: '-2s' }}><path d="M 66 186 C 60 168 74 158 68 142 C 80 160 72 172 76 186 Z" fill="#16A34A" /></g>
          <g className="m-alga" style={{ animationDelay: '-3.2s' }}><path d="M 374 186 C 366 158 386 148 376 112 C 392 142 382 164 386 186 Z" fill="#15803D" /></g>

          {/* Burbujas */}
          {!dormido && animo !== 'critica' && [[130, 0], [190, -1.6], [268, -3], [330, -0.8]].map(([x, retardo]) => (
            <circle key={x} className="m-burbuja" cx={x} cy={FONDO - 12} r={x % 3 === 0 ? 3.5 : 2.5} fill="#fff" fillOpacity="0.75" style={{ animationDelay: `${retardo}s` }} />
          ))}

          {/* Pez */}
          <g transform={`translate(${animo === 'critica' ? 205 : 130} ${yPez})`}>
            {dormido ? (
              <g transform="translate(70 52)">
                <g className="m-dormido"><Pez animo={animo} /></g>
                <g fill="var(--color-tinta-2)" fontWeight="700" fontSize="13">
                  <text className="m-zzz" x="34" y="-22">z</text>
                  <text className="m-zzz" x="42" y="-30" fontSize="16">z</text>
                  <text className="m-zzz" x="52" y="-40" fontSize="19">z</text>
                </g>
              </g>
            ) : animo === 'critica' ? (
              <Pez animo={animo} />
            ) : (
              <g className="m-pez" style={{ '--vel': info.vel, '--cola': info.cola }}><Pez animo={animo} /></g>
            )}
          </g>

          {/* Turbidez real: una capa encima cuya opacidad sigue al NTU */}
          <g opacity={opacidadTurbidez(turbidez)}>
            <path d={ola(superficie)} fill="#78716C" />
          </g>

          {/* Termómetro: suda si la temperatura está fuera de rango */}
          {fueraTemp && !dormido && (
            <g transform="translate(386 14)" aria-hidden>
              <rect x="-4" y="0" width="8" height="42" rx="4" fill="#fff" stroke="#0F172A" strokeWidth="1.5" />
              <rect x="-1.75" y={temperatura > limiteTemp.max ? 6 : 26} width="3.5" height={temperatura > limiteTemp.max ? 36 : 16} fill="#E11D48" />
              <circle cy="46" r="7" fill="#E11D48" stroke="#0F172A" strokeWidth="1.5" />
              {temperatura > limiteTemp.max && (
                <g fill="#38BDF8">
                  <path className="m-gota" d="M -13 6 q -3 5 0 7 q 3 -2 0 -7 Z" />
                  <path className="m-gota" d="M 13 12 q -3 5 0 7 q 3 -2 0 -7 Z" />
                </g>
              )}
            </g>
          )}

          {/* Señal perdida: estática gris encima de toda la pecera */}
          {dormido && (
            <g>
              <rect className="m-estatica" x="-20" y="-20" width={ANCHO + 40} height={ALTO + 40} filter={`url(#${idRuido})`} opacity="0.32" />
              <rect x="136" y="14" width="148" height="26" rx="13" fill="#0F172A" />
              <text x="210" y="31" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Señal perdida</text>
            </g>
          )}
        </g>
      </svg>

      <div className="flex flex-1 flex-col justify-center gap-1 p-4">
        <p className={`flex items-start gap-1.5 text-sm font-semibold ${info.color}`}>
          <Icono aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
          {info.texto}
        </p>
        <p className="text-xs text-tinta-2 num">
          {nivelCm != null ? `Nivel ${nivelCm.toFixed(0)} cm` : 'Nivel sin dato: altura del agua ilustrativa'}
          {' · '}
          {turbidez != null ? `Turbidez ${turbidez.toFixed(0)} NTU` : 'Turbidez sin dato'}
        </p>
      </div>
    </section>
  );
}

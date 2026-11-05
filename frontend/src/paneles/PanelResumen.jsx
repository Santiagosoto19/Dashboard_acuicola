// Resumen: bento asimétrico de 12 columnas. Orden de lectura y de entrada:
// hero → nodos → lecturas → gráficas.
import { useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import HeroEstado from '../components/HeroEstado';
import Mascota from '../components/Mascota';
import TarjetaNodo from '../components/TarjetaNodo';
import TarjetaVariable from '../components/TarjetaVariable';
import LineaTiempo from '../components/LineaTiempo';
import Donut from '../components/Donut';
import { Tarjeta } from '../components/Comunes';
import { CONTENEDOR_ENTRADA, ITEM_ENTRADA, ITEM_ENTRADA_REDUCIDO } from '../lib/movimiento';
import { armarLecturas, ordenarPorSeveridad } from '../lib/severidad';

// Lectura más reciente de una variable en todo el estanque, para la pecera.
function valorVigente(estado, clave) {
  const c = estado.nodos.map((n) => n.lecturas[clave]).filter((l) => l?.vigente).sort((a, b) => b.ts - a.ts);
  return c[0]?.valor ?? null;
}

export default function PanelResumen({ estado, nodosVisibles, lecturas, alertas, red, primeraVez, varResaltada, alElegirVariable, alAbrirVariable }) {
  const reducido = useReducedMotion();
  const item = reducido ? ITEM_ENTRADA_REDUCIDO : ITEM_ENTRADA;
  const orden = useMemo(() => ordenarPorSeveridad(armarLecturas(estado, nodosVisibles)), [estado, nodosVisibles]);
  const nodoAlto = useRef(1);
  // El nodo con peor estado queda al frente: sombra mayor y z superior.
  const pesos = { critica: 2, advertencia: 1 };
  const peor = [...nodosVisibles].sort((a, b) => (pesos[b.nivel] ?? 0) - (pesos[a.nivel] ?? 0))[0];
  nodoAlto.current = peor?.nodo;
  const tempLimite = estado.variables.find((v) => v.clave === 'temperatura')?.limite ?? {};

  return (
    <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-12" variants={CONTENEDOR_ENTRADA} initial={primeraVez ? 'oculto' : false} animate="visible">
      <motion.div variants={item} className="min-w-0 md:col-span-7 xl:col-span-8">
        <HeroEstado
          estado={estado}
          servidorOk={red.servidorOk}
          actualizado={red.actualizado}
          ciclo={red.ciclo}
          cargando={red.cargando}
          alElegirVariable={alElegirVariable}
        />
      </motion.div>
      <motion.div variants={item} className="min-w-0 md:col-span-5 xl:col-span-4">
        <Mascota
          estado={estado}
          turbidez={valorVigente(estado, 'turbidez')}
          nivelCm={valorVigente(estado, 'nivel')}
          temperatura={valorVigente(estado, 'temperatura')}
          limiteTemp={tempLimite}
        />
      </motion.div>

      {nodosVisibles.map((n) => (
        <motion.div key={n.nodo} variants={item} className={`min-w-0 ${nodosVisibles.length === 1 ? 'md:col-span-12' : 'md:col-span-6'}`}>
          <TarjetaNodo nodo={n} variables={estado.variables} desactualizado={estado.desactualizado} elevacion={n.nodo === nodoAlto.current ? 'alta' : 'base'} />
        </motion.div>
      ))}

      <motion.section variants={item} className="min-w-0 md:col-span-12" aria-labelledby="titulo-lecturas">
        <h2 id="titulo-lecturas" className="mb-3 mt-2 text-lg font-semibold tracking-tight">Lecturas actuales</h2>
        <div className="carrusel grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {orden.map((it, i) => (
            <TarjetaVariable
              key={it.variable.clave}
              item={it}
              grande={i === 0}
              margen={estado.margenCerca}
              nivel={estado.nivel}
              desactualizado={estado.desactualizado}
              resaltada={varResaltada === it.variable.clave}
              alAbrir={alAbrirVariable}
            />
          ))}
        </div>
      </motion.section>

      <motion.div variants={item} className="min-w-0 md:col-span-7 xl:col-span-8">
        <Tarjeta titulo="Línea de tiempo del estado por nodo"><LineaTiempo lecturas={lecturas} /></Tarjeta>
      </motion.div>
      <motion.div variants={item} className="min-w-0 md:col-span-5 xl:col-span-4">
        <Tarjeta titulo="Distribución de severidades" nota="Estado general en cada medición del rango">
          <Donut distribucion={alertas?.distribucion} />
        </Tarjeta>
      </motion.div>
    </motion.div>
  );
}

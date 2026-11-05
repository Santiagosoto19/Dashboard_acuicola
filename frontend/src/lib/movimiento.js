// Duraciones y curvas de animación compartidas. Ver DESIGN.md.
export const RESORTE = { type: 'spring', stiffness: 300, damping: 30 };
export const RESORTE_AGUJA = { stiffness: 140, damping: 18, mass: 1 };
export const SALIDA_EXPO = [0.16, 1, 0.3, 1];
export const DUR = { rapida: 0.15, media: 0.3, lenta: 0.6 };

// Entrada escalonada de las tarjetas: 70 ms entre cada una, en orden de lectura.
export const CONTENEDOR_ENTRADA = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
export const ITEM_ENTRADA = {
  oculto: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: SALIDA_EXPO } },
};
export const ITEM_ENTRADA_REDUCIDO = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

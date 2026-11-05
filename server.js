// Servidor del dashboard: API JSON de solo lectura y archivos estáticos.
require('dotenv').config();

const path = require('path');
const express = require('express');
const { PUERTO } = require('./config');
const { ErrorParametro } = require('./lib/datos');

const app = express();
app.disable('x-powered-by');

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/estado'));
app.use('/api', require('./routes/lecturas'));
app.use('/api', require('./routes/alertas'));
app.use('/api', require('./routes/nodos'));
app.use('/api', require('./routes/exportar'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// El detalle del error se queda en el servidor: nunca llega al navegador,
// porque un error de conexión podría revelar el host o el usuario de la BD.
app.use((err, req, res, next) => {
  if (err instanceof ErrorParametro) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(`[api] ${req.method} ${req.path}:`, err.message);
  res.status(503).json({ error: 'No se pudo consultar la base de datos' });
});

app.listen(PUERTO, () => console.log(`Dashboard en http://localhost:${PUERTO}`));

// Acceso a PostgreSQL (Supabase). Las credenciales solo existen en el servidor.
const { Pool } = require('pg');

let pool = null;

function obtenerPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta la variable de entorno DATABASE_URL');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // El pooler de Supabase cifra la conexión, pero su certificado no está en
      // el almacén de confianza de Node. Para verificarlo, descargue el CA del
      // panel de Supabase y páselo aquí como ssl.ca.
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    // Sin este manejador, un corte de red en una conexión inactiva tumba el proceso.
    pool.on('error', (err) => console.error('[bd] error en conexión inactiva:', err.message));
  }
  return pool;
}

// Ejecuta una consulta parametrizada en una transacción de SOLO LECTURA.
// Se abre por consulta porque el pooler en modo transacción (puerto 6543) no
// conserva ajustes de sesión. Si alguna consulta intentara escribir, PostgreSQL
// la rechazaría, aunque el usuario de conexión tenga permisos de escritura.
async function consultar(sql, parametros = []) {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN READ ONLY; SET LOCAL statement_timeout = '15s'");
    const { rows } = await cliente.query(sql, parametros);
    await cliente.query('COMMIT');
    return rows;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = { consultar };

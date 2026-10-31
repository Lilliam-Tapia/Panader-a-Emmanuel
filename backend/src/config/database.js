
require('dotenv').config();

const sql = require('mssql');
const { DefaultAzureCredential } = require('@azure/identity');

const config = {
  server: 'sql-panaderia-emmanuel.database.windows.net',
  database: 'Panaderiaemmanuel',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false
  },
  authentication: {
    type: 'azure-active-directory-default',
    options: {
      credential: new DefaultAzureCredential()
    }
  }
};

let pool;

async function conectarBD() {
  try {
    if (pool && pool.connected) {
      return pool;
    }

    pool = await new sql.ConnectionPool(config).connect();

    console.log('Conexión a Azure SQL establecida correctamente');

    return pool;
  } catch (error) {
    console.error('Error al conectar con Azure SQL:', error.message);
    throw error;
  }
}

module.exports = { sql, conectarBD };

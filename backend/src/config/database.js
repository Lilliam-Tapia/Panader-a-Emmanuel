
const sql = require('mssql/msnodesqlv8')

const config = {
  connectionString:
    'Driver={ODBC Driver 18 for SQL Server};Server=LAPTOP-4N0KUFG6;Database=PanaderiaEmmanuel;Trusted_Connection=yes;TrustServerCertificate=yes;Encrypt=no;'
}

let pool

async function conectarBD() {
  try {
    if (pool && pool.connected) {
      return pool
    }

    pool = await sql.connect(config)
    console.log('Conexión a SQL Server establecida correctamente')
    return pool
  } catch (error) {
    console.error('Error al conectar con SQL Server:', error.message)
    throw error
  }
}

module.exports = { sql, conectarBD }

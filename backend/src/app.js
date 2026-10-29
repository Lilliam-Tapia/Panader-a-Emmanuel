
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend de Panadería Emmanuel funcionando correctamente'
  })
})

app.get('/api/estado', (req, res) => {
  res.json({
    estado: 'activo',
    sistema: 'Panadería Emmanuel'
  })
})


const { conectarBD } = require('./config/database')

app.get('/api/prueba-db', async (req, res) => {
  try {
    const pool = await conectarBD()

    const resultado = await pool.request().query(`
      SELECT
        DB_NAME() AS BaseDeDatos,
        GETDATE() AS FechaServidor
    `)

    res.json({
      mensaje: 'Conexión a SQL Server exitosa',
      datos: resultado.recordset[0]
    })
  } catch (error) {
    res.status(500).json({
      mensaje: 'No se pudo conectar con SQL Server',
      error: error.message
    })
  }
})

const productosRoutes = require('./routes/productos')
app.use('/api/productos', productosRoutes)
const authRoutes = require('./routes/auth.routes')
app.use('/api/auth', authRoutes)
const ventasRoutes = require('./routes/ventas');
app.use('/api/ventas', ventasRoutes);


module.exports = app

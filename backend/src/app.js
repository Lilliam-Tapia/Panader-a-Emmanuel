
const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

const { conectarBD } = require('./config/database')

// Estado del backend
app.get('/api/estado', (req, res) => {
  res.json({
    estado: 'activo',
    sistema: 'Panadería Emmanuel'
  })
})

// Prueba de conexión con la base de datos
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

// Rutas de la API
const productosRoutes = require('./routes/productos')
app.use('/api/productos', productosRoutes)

const authRoutes = require('./routes/auth.routes')
app.use('/api/auth', authRoutes)

const ventasRoutes = require('./routes/ventas')
app.use('/api/ventas', ventasRoutes)

// Archivos de React
app.use(express.static(path.join(__dirname, '../public')))

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// Permite cargar las rutas de la interfaz React
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next()
  }

  res.sendFile(path.join(__dirname, '../public/index.html'))
})

module.exports = app

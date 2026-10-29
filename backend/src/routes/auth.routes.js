
const express = require('express')
const jwt = require('jsonwebtoken')
const {
  buscarPorNombreUsuario,
  verificarContrasena
} = require('../models/Usuario')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { nombreUsuario, contrasena } = req.body

    if (
      typeof nombreUsuario !== 'string' ||
      typeof contrasena !== 'string' ||
      !nombreUsuario.trim() ||
      !contrasena
    ) {
      return res.status(400).json({
        mensaje: 'Ingresa tu usuario y contraseña.'
      })
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        mensaje: 'Falta configurar JWT_SECRET en el backend.'
      })
    }

    const usuario = await buscarPorNombreUsuario(
      nombreUsuario.trim()
    )

    if (!usuario || !usuario.Estado) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos.'
      })
    }

    const contrasenaValida = await verificarContrasena(
      contrasena,
      usuario.ContrasenaHash
    )

    if (!contrasenaValida) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos.'
      })
    }

    const token = jwt.sign(
      {
        idUsuario: usuario.IdUsuario,
        nombreUsuario: usuario.NombreUsuario,
        rol: usuario.NombreRol
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    return res.json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        idUsuario: usuario.IdUsuario,
        nombreCompleto: usuario.NombreCompleto,
        nombreUsuario: usuario.NombreUsuario,
        idRol: usuario.IdRol,
        rol: usuario.NombreRol
      }
    })
  } catch (error) {
    console.error('Error al iniciar sesión:', error)

    return res.status(500).json({
      mensaje: 'Ocurrió un error al iniciar sesión.'
    })
  }
})

module.exports = router

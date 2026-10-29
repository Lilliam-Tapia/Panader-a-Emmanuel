
const jwt = require('jsonwebtoken')

function verificarToken(req, res, next) {
  const autorizacion = req.headers.authorization

  if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
    return res.status(401).json({
      mensaje: 'Debes iniciar sesión para continuar.'
    })
  }

  const token = autorizacion.split(' ')[1]

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (error) {
    return res.status(401).json({
      mensaje: 'La sesión es inválida o ha expirado.'
    })
  }
}

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para realizar esta acción.'
      })
    }

    next()
  }
}

module.exports = {
  verificarToken,
  permitirRoles
}

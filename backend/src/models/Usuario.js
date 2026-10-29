
const { conectarBD } = require('../config/database')
const { sql } = require('../config/database')
const bcrypt = require('bcryptjs')

async function buscarPorNombreUsuario(nombreUsuario) {
  const pool = await conectarBD()

  const resultado = await pool.request()
    .input('NombreUsuario', sql.VarChar(50), nombreUsuario)
    .query(`
      SELECT
        u.IdUsuario,
        u.NombreCompleto,
        u.NombreUsuario,
        u.ContrasenaHash,
        u.Estado,
        u.IdRol,
        r.NombreRol
      FROM dbo.Usuarios u
      INNER JOIN dbo.Roles r ON u.IdRol = r.IdRol
      WHERE u.NombreUsuario = @NombreUsuario
    `)

  return resultado.recordset[0] || null
}

async function verificarContrasena(contrasena, hash) {
  return bcrypt.compare(contrasena, hash)
}

module.exports = {
  buscarPorNombreUsuario,
  verificarContrasena
}

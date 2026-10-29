const bcrypt = require('bcryptjs')

async function main() {
  const contrasena = process.argv[2]

  if (!contrasena) {
    console.error('Debes proporcionar una contraseña.')
    process.exitCode = 1
    return
  }

  console.log(await bcrypt.hash(contrasena, 12))
}

main()
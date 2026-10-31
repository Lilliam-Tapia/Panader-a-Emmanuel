
require('dotenv').config();

const app = require('./app');
const { conectarBD } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Iniciar el servidor web
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});

// Comprobar la conexión con Azure SQL
conectarBD()
  .then(() => {
    console.log('Base de datos conectada correctamente');
  })
  .catch((error) => {
    console.error('Error de conexión con la base de datos:', error.message);
  });

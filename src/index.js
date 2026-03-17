require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Importar rutas
const downloadRoutes = require('./routes/download.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba (health check)
app.get('/', (req, res) => {
  res.json({
    message: 'API de descarga de YouTube funcionando correctamente',
    endpoints: {
      descargar: 'POST /api/descargar',
      info: 'POST /api/info'
    }
  });
});

// Rutas de la API
app.use('/api', downloadRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('Endpoints disponibles:');
  console.log('  POST /api/descargar - Descargar audio como MP3');
  console.log('  POST /api/info      - Obtener información del video');
});

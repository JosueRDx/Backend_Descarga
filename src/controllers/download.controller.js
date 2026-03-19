const youtubeService = require('../services/youtube.service');
const { deleteFileAfterDelay } = require('../utils/fileManager');

/**
 * Controlador para descargar audio de YouTube como MP3
 * POST /api/descargar
 * Body: { url: "https://youtube.com/watch?v=xxx" }
 */
const descargarAudio = async (req, res) => {
  try {
    const { url } = req.body;

    console.log(`Iniciando descarga: ${url}`);

    // 1. Descargar y convertir a MP3
    const result = await youtubeService.downloadAndConvertToMp3(url);

    // 2. Limpiar el título para usarlo como nombre de archivo
    const safeTitle = result.videoInfo.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const downloadName = `${safeTitle}.mp3`;

    // 3. Enviar archivo como descarga
    res.download(result.filePath, downloadName, (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err.message);
        // Si hay error y no se han enviado headers, enviar respuesta de error
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: 'Error al enviar el archivo'
          });
        }
      }

      // 4. Programar eliminación del archivo después de enviar (5 minutos)
      console.log(`Archivo enviado: ${downloadName}`);
      deleteFileAfterDelay(result.filePath, 300000);
    });

  } catch (error) {
    console.error('Error en descarga:', error.message);

    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

/**
 * Controlador para obtener información del video sin descargar
 * POST /api/info
 * Body: { url: "https://youtube.com/watch?v=xxx" }
 */
const obtenerInfo = async (req, res) => {
  try {
    const { url } = req.body;

    const videoInfo = await youtubeService.getVideoInfo(url);

    res.json({
      success: true,
      data: videoInfo
    });

  } catch (error) {
    console.error('Error al obtener info:', error.message);

    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

module.exports = {
  descargarAudio,
  obtenerInfo
};

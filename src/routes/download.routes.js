const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download.controller');

/**
 * @route   POST /api/descargar
 * @desc    Descarga audio de YouTube y lo convierte a MP3
 * @body    { url: "https://youtube.com/watch?v=xxx" }
 * @returns Archivo MP3 descargable
 */
router.post('/descargar', downloadController.descargarAudio);

/**
 * @route   POST /api/info
 * @desc    Obtiene información del video sin descargar
 * @body    { url: "https://youtube.com/watch?v=xxx" }
 * @returns { success, data: { title, author, duration, thumbnail } }
 */
router.post('/info', downloadController.obtenerInfo);

module.exports = router;

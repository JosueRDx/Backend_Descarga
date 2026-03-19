/**
 * Middleware de validación de URLs de YouTube
 * Valida que la URL exista y pertenezca a YouTube antes de procesarla
 */

/**
 * Expresión regular robusta para validar URLs de YouTube
 */
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}([&?].*)?$/;

/**
 * Valida si una cadena es una URL de YouTube válida
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
const isValidYoutubeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
};

/**
 * Middleware que valida la URL de YouTube en el body de la petición
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Función next de Express
 */
const validateUrl = (req, res, next) => {
  const { url } = req.body;

  // Validar que se envió la URL
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'La URL es requerida'
    });
  }

  // Validar que sea una URL de YouTube válida
  if (!isValidYoutubeUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'URL de YouTube no válida. Formatos aceptados: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/'
    });
  }

  // URL válida, continuar al controlador
  next();
};

module.exports = {
  validateUrl,
  isValidYoutubeUrl,
  YOUTUBE_URL_REGEX
};

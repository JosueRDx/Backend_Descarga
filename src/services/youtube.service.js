const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const { generateUniqueFileName, getTmpFilePath } = require('../utils/fileManager');

/**
 * Rutas posibles para el archivo de cookies
 */
const COOKIES_PATHS = [
  '/etc/secrets/cookies.txt',
  path.join(process.cwd(), 'cookies.txt')
];

/**
 * Detecta y retorna la ruta del archivo de cookies si existe
 * @returns {string|null} - Ruta del archivo de cookies o null si no existe
 */
const getCookiesPath = () => {
  for (const cookiePath of COOKIES_PATHS) {
    if (fs.existsSync(cookiePath)) {
      console.log(`[cookies] Archivo encontrado: ${cookiePath}`);
      return cookiePath;
    }
  }
  console.log('[cookies] No se encontró archivo de cookies, continuando sin autenticación');
  return null;
};

/**
 * Genera las opciones base para youtube-dl-exec incluyendo cookies si están disponibles
 * @returns {Object} - Opciones base para yt-dlp
 */
const getBaseOptions = () => {
  const options = {
    noCheckCertificates: true,
    preferFreeFormats: true
  };

  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    options.cookies = `"${cookiesPath}"`;
  }

  return options;
};

/**
 * Expresión regular para validar URLs de YouTube
 */
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

/**
 * Valida que la URL sea de YouTube
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
const isValidYoutubeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return YOUTUBE_REGEX.test(url);
};

/**
 * Obtiene información del video de YouTube
 * @param {string} url - URL del video
 * @returns {Promise<Object>} - Información del video
 */
const getVideoInfo = async (url) => {
  try {
    const info = await youtubedl(url, {
      ...getBaseOptions(),
      dumpSingleJson: true,
      noWarnings: true
    });

    return {
      title: info.title || 'Sin título',
      author: info.uploader || info.channel || 'Desconocido',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null
    };
  } catch (error) {
    throw new Error(`Error al obtener información del video: ${error.message}`);
  }
};

/**
 * Descarga el audio de YouTube y lo convierte a MP3 usando yt-dlp
 * @param {string} url - URL del video de YouTube
 * @returns {Promise<Object>} - Objeto con la ruta del archivo y metadata
 */
const downloadAndConvertToMp3 = async (url) => {
  // 1. Validar URL
  if (!isValidYoutubeUrl(url)) {
    throw new Error('URL de YouTube no válida');
  }

  // 2. Obtener información del video
  const videoInfo = await getVideoInfo(url);

  // 3. Generar nombre de archivo MP3
  const mp3FileName = generateUniqueFileName('mp3');
  const mp3FilePath = getTmpFilePath(mp3FileName);

  // 4. Remover la extensión .mp3 para el output template (yt-dlp la agrega automáticamente)
  const outputTemplate = mp3FilePath.replace(/\.mp3$/, '');

  try {
    console.log('Iniciando descarga y conversión a MP3 con yt-dlp...');

    // 5. Descargar y convertir usando yt-dlp con ffmpeg
    await youtubedl(url, {
      ...getBaseOptions(),
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
      output: `"${outputTemplate}.%(ext)s"`,
      noWarnings: true,
      noPlaylist: true
    });

    console.log('Descarga y conversión a MP3 completada');

    // 6. Retornar información del archivo convertido
    return {
      filePath: mp3FilePath,
      fileName: mp3FileName,
      videoInfo: videoInfo
    };
  } catch (error) {
    throw new Error(`Error en descarga/conversión: ${error.message}`);
  }
};

module.exports = {
  isValidYoutubeUrl,
  getVideoInfo,
  downloadAndConvertToMp3
};

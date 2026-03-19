const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateUniqueFileName, getTmpFilePath } = require('../utils/fileManager');

/**
 * Rutas posibles para el archivo de cookies
 */
const COOKIES_SOURCE_PATHS = [
  '/etc/secrets/cookies.txt',
  path.join(process.cwd(), 'cookies.txt')
];

/**
 * Ruta temporal para cookies
 */
const TMP_COOKIES_PATH = path.join(os.tmpdir(), 'yt-cookies.txt');

/**
 * Variable para cachear la ruta de cookies válida
 */
let cachedCookiesPath = null;

/**
 * Copia las cookies a un directorio temporal escribible
 * @returns {string|null} - Ruta temporal de cookies o null si no existe
 */
const prepareCookiesPath = () => {
  // Si ya tenemos una ruta cacheada y el archivo existe, usarla
  if (cachedCookiesPath && fs.existsSync(cachedCookiesPath)) {
    return cachedCookiesPath;
  }

  // Buscar el archivo de cookies en las rutas origen
  for (const sourcePath of COOKIES_SOURCE_PATHS) {
    if (fs.existsSync(sourcePath)) {
      try {
        // Copiar cookies a directorio temporal
        fs.copyFileSync(sourcePath, TMP_COOKIES_PATH);
        console.log(`[cookies] Copiado de ${sourcePath} a ${TMP_COOKIES_PATH}`);
        cachedCookiesPath = TMP_COOKIES_PATH;
        return cachedCookiesPath;
      } catch (error) {
        console.error(`[cookies] Error al copiar cookies: ${error.message}`);
        // Si falla la copia, intentar usar el original
        if (sourcePath === path.join(process.cwd(), 'cookies.txt')) {
          cachedCookiesPath = sourcePath;
          return cachedCookiesPath;
        }
      }
    }
  }

  console.log('[cookies] No se encontró archivo de cookies, continuando sin autenticación');
  return null;
};

/**
 * Genera las opciones base para youtube-dl-exec 
 * @returns {Object} - Opciones base para yt-dlp
 */
const getDownloadOptions = () => {
  const options = {
    noCheckCertificates: true,
    preferFreeFormats: true
  };

  const cookiesPath = prepareCookiesPath();
  if (cookiesPath) {
    // Manejar rutas con espacios
    options.cookies = cookiesPath.includes(' ') ? `"${cookiesPath}"` : cookiesPath;
  }

  return options;
};

/**
 * Genera opciones mínimas para obtener metadata
 * @returns {Object} - Opciones para extracción de info
 */
const getInfoOptions = () => {
  const options = {
    noCheckCertificates: true,
    skipDownload: true,
    noPlaylist: true
  };

  const cookiesPath = prepareCookiesPath();
  if (cookiesPath) {
    options.cookies = cookiesPath.includes(' ') ? `"${cookiesPath}"` : cookiesPath;
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
      ...getInfoOptions(),
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
      ...getDownloadOptions(),
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

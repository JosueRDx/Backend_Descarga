const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateUniqueFileName, getTmpFilePath } = require('../utils/fileManager');
const cacheVideo = require('../utils/cacheVideo');

/**
 * Instancia de yt-dlp.
 * En Docker instalamos el binario aparte (YT_DLP_PATH) para poder actualizarlo
 * sin depender de la caché de npm/Docker, en local se usa el que baja npm
 */
const YT_DLP_BINARY = process.env.YT_DLP_PATH || youtubedl.constants.YOUTUBE_DL_PATH;

const ytdlp = process.env.YT_DLP_PATH
  ? youtubedl.create(process.env.YT_DLP_PATH)
  : youtubedl;

/**
 * youtube-dl-exec solo usa shell en Windows cuando la ruta del binario tiene
 * espacios, con shell hay que entrecomillar las rutas con espacios, sin shell
 * (Linux/Render) las comillas acabarían formando parte de la ruta
 */
const USES_SHELL = process.platform === 'win32' && /\s/.test(YT_DLP_BINARY);

/**
 * Entrecomilla una ruta solo si el proceso se lanza a través de un shell
 * @param {string} value - Ruta a escapar
 * @returns {string}
 */
const quoteIfNeeded = (value) =>
  USES_SHELL && /\s/.test(value) ? `"${value}"` : value;

/**
 * Runtime de JavaScript que usa yt-dlp para resolver los retos de YouTube.
 * Sin esto YouTube devuelve solo formatos "storyboard" y yt-dlp falla con
 * "Requested format is not available", se puede desactivar con YTDLP_JS_RUNTIME=none
 */
const JS_RUNTIME = process.env.YTDLP_JS_RUNTIME || 'node';

/**
 * Selector de formato para audio
 */
const AUDIO_FORMAT = 'bestaudio/best';

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
 * Evita repetir el log de "sin cookies" en cada reintento
 */
let cookiesMissingLogged = false;

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
        // Copiar cookies a directorio temporal (yt-dlp necesita poder reescribirlas)
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

  if (!cookiesMissingLogged) {
    console.log('[cookies] No se encontró archivo de cookies, continuando sin autenticación');
    cookiesMissingLogged = true;
  }
  return null;
};

/**
 * Estrategias de extracción, en orden de preferencia
 * YouTube bloquea distintos clientes según la IP (las IPs de Render son de
 * datacenter y suelen estar restringidas), así que probamos varias combinaciones
 * de cliente / cookies antes de darnos por vencidos
 */
const STRATEGIES = [
  { name: 'default + cookies', extractorArgs: null, useCookies: true },
  { name: 'tv,web_safari + cookies', extractorArgs: 'youtube:player_client=tv,web_safari', useCookies: true },
  { name: 'android_vr,mweb + cookies', extractorArgs: 'youtube:player_client=android_vr,mweb', useCookies: true },
  { name: 'default sin cookies', extractorArgs: null, useCookies: false }
];

/**
 * Índice de la última estrategia que funcionó (para no reintentar desde cero)
 */
let preferredStrategy = 0;

/**
 * Cache de la comprobación de soporte de --js-runtimes
 */
let jsRuntimeSupported = null;

/**
 * Comprueba si el binario de yt-dlp soporta --js-runtimes (versiones recientes)
 * @returns {Promise<boolean>}
 */
const supportsJsRuntime = async () => {
  if (JS_RUNTIME === 'none') return false;
  if (jsRuntimeSupported !== null) return jsRuntimeSupported;

  try {
    const { exitCode } = await ytdlp.exec('--version', { jsRuntimes: JS_RUNTIME });
    jsRuntimeSupported = exitCode === 0;
  } catch (error) {
    jsRuntimeSupported = false;
  }

  if (!jsRuntimeSupported) {
    console.warn(
      `[yt-dlp] El binario no soporta --js-runtimes ${JS_RUNTIME}; ` +
      'actualiza yt-dlp o YouTube devolverá formatos incompletos.'
    );
  }

  return jsRuntimeSupported;
};

/**
 * Extrae un mensaje de error legible de un fallo de yt-dlp
 * @param {Error} error
 * @returns {string}
 */
const summarizeError = (error) => {
  const raw = (error && (error.stderr || error.message)) || 'Error desconocido';
  const lines = String(raw)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const errorLines = lines.filter((line) => line.startsWith('ERROR:'));
  return (errorLines.length ? errorLines : lines).slice(-3).join(' | ');
};

/**
 * Construye los flags de yt-dlp para una estrategia concreta
 * @param {Object} strategy - Estrategia de extracción
 * @param {Object} extraFlags - Flags específicos de la operación
 * @returns {Promise<Object>}
 */
const buildFlags = async (strategy, extraFlags) => {
  const flags = {
    noCheckCertificates: true,
    noWarnings: true,
    noPlaylist: true,
    format: AUDIO_FORMAT,
    retries: 3,
    socketTimeout: 30,
    ...extraFlags
  };

  if (await supportsJsRuntime()) {
    flags.jsRuntimes = JS_RUNTIME;
  }

  if (strategy.extractorArgs) {
    flags.extractorArgs = strategy.extractorArgs;
  }

  if (strategy.useCookies) {
    const cookiesPath = prepareCookiesPath();
    if (cookiesPath) flags.cookies = quoteIfNeeded(cookiesPath);
  }

  return flags;
};

/**
 * Ejecuta yt-dlp probando las distintas estrategias hasta que una funcione
 * @param {string} url - URL del video
 * @param {Object} extraFlags - Flags específicos de la operación
 * @param {string} label - Descripción de la operación
 * @returns {Promise<Object|string>} - Salida de yt-dlp
 */
const runYtDlp = async (url, extraFlags, label) => {
  const order = [preferredStrategy, ...STRATEGIES.map((_, index) => index)]
    .filter((index, position, all) => all.indexOf(index) === position);

  let lastError;

  for (const index of order) {
    const strategy = STRATEGIES[index];
    try {
      const result = await ytdlp(url, await buildFlags(strategy, extraFlags));
      preferredStrategy = index;
      if (index !== order[0]) {
        console.log(`[yt-dlp] ${label}: OK con estrategia "${strategy.name}"`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`[yt-dlp] ${label}: falló con estrategia "${strategy.name}" -> ${summarizeError(error)}`);
    }
  }

  throw new Error(summarizeError(lastError));
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
  // Si el video ya se consultó, se responde al instante en lugar de repetir
  const enCache = cacheVideo.obtener(url);
  if (enCache) {
    console.log(`[cache] Información reutilizada de ${cacheVideo.extraerIdVideo(url)}`);
    return enCache;
  }

  try {
    const info = await runYtDlp(
      url,
      { dumpSingleJson: true, skipDownload: true },
      'obtener info'
    );

    const resultado = {
      title: info.title || 'Sin título',
      author: info.uploader || info.channel || 'Desconocido',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null
    };

    // Se guarda el resultado en caché para no repetir la consulta
    cacheVideo.guardar(url, resultado);
    return resultado;
  } catch (error) {
    throw new Error(`Error al obtener información del video: ${error.message}`);
  }
};

/**
 * Busca el archivo generado por yt-dlp cuando la extensión no es la esperada
 * @param {string} outputTemplate - Ruta base
 * @returns {string|null} - Ruta del archivo encontrado
 */
const findGeneratedFile = (outputTemplate) => {
  const dir = path.dirname(outputTemplate);
  const base = path.basename(outputTemplate);

  try {
    const match = fs.readdirSync(dir).find((file) => file.startsWith(`${base}.`));
    return match ? path.join(dir, match) : null;
  } catch (error) {
    return null;
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

  // 2. Obtener información del video y si existe en caché se reutiliza
  const videoInfo = await getVideoInfo(url);

  // 3. Generar nombre de archivo MP3
  const mp3FileName = generateUniqueFileName('mp3');
  const mp3FilePath = getTmpFilePath(mp3FileName);

  // 4. Remover la extensión .mp3 para el output template (yt-dlp la agrega automáticamente)
  const outputTemplate = mp3FilePath.replace(/\.mp3$/, '');

  try {
    console.log('Iniciando descarga y conversión a MP3 con yt-dlp...');

    // 5. Descargar y convertir usando yt-dlp con ffmpeg
    await runYtDlp(
      url,
      {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 0,
        output: quoteIfNeeded(`${outputTemplate}.%(ext)s`)
      },
      'descargar audio'
    );

    console.log('Descarga y conversión a MP3 completada');

    // 6. Verificar que el archivo existe realmente
    if (!fs.existsSync(mp3FilePath)) {
      const generated = findGeneratedFile(outputTemplate);
      if (!generated) {
        throw new Error('yt-dlp terminó pero no se generó ningún archivo de audio');
      }
      console.warn(`[yt-dlp] Archivo generado con otra extensión: ${generated}`);
      fs.renameSync(generated, mp3FilePath);
    }

    // 7. Retornar información del archivo convertido
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

/**
 * Caché en memoria de la información de videos ya consultados
 */

/**
 * Tiempo de duración de la información del video en caché (6 horas)
 */
const VIGENCIA_MS = 6 * 60 * 60 * 1000;

/**
 * Número máximo de videos guardados en caché, para controlar el uso de memoria (200 videos)
 */
const CAPACIDAD = 200;

/**
 * Expresión para extraer el identificador de 11 caracteres del video
 */
const ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const entradas = new Map();

/**
 * Extrae el identificador del video de una URL de YouTube.
 * @param {string} url - URL del video
 * @returns {string|null} - Identificador o null si no es una URL de YouTube
 */
const extraerIdVideo = (url) => {
  if (!url || typeof url !== 'string') return null;
  const coincidencia = url.match(ID_REGEX);
  return coincidencia ? coincidencia[1] : null;
};

/**
 * Obtiene la información guardada de un video
 * @param {string} url - URL del video
 * @returns {Object|null} - Información del video o null si no está o caducó
 */
const obtener = (url) => {
  const id = extraerIdVideo(url);
  if (!id) return null;

  const entrada = entradas.get(id);
  if (!entrada) return null;

  if (Date.now() - entrada.momento > VIGENCIA_MS) {
    entradas.delete(id);
    return null;
  }

  entradas.delete(id);
  entradas.set(id, entrada);
  return entrada.info;
};

/**
 * Guarda la información de un video
 * @param {string} url - URL del video
 * @param {Object} info - Información a guardar
 */
const guardar = (url, info) => {
  const id = extraerIdVideo(url);
  if (!id || !info) return;

  entradas.delete(id);
  entradas.set(id, { info, momento: Date.now() });

  if (entradas.size > CAPACIDAD) {
    entradas.delete(entradas.keys().next().value);
  }
};

/**
 * Vacía la caché por completo
 */
const limpiar = () => entradas.clear();

/**
 * Número de videos actualmente en caché
 * @returns {number}
 */
const tamano = () => entradas.size;

module.exports = {
  extraerIdVideo,
  obtener,
  guardar,
  limpiar,
  tamano,
  VIGENCIA_MS,
  CAPACIDAD
};

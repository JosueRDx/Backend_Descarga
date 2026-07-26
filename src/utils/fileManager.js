const fs = require('fs');
const path = require('path');

/**
 * Carpeta donde se guardan los MP3 temporales.
 * Se ancla a la raíz del proyecto (src/utils -> ../..), no al directorio de
 * trabajo, para que no dependa de desde dónde se arranque el proceso.
 * Se puede sobreescribir con la variable de entorno TMP_DIR.
 */
const TMP_DIR = process.env.TMP_DIR || path.join(__dirname, '..', '..', 'tmp');

/**
 * Crea la carpeta temporal si no existe
 * @returns {string} - Ruta de la carpeta temporal
 */
const ensureTmpDir = () => {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    console.log(`Carpeta temporal creada: ${TMP_DIR}`);
  }
  return TMP_DIR;
};

/**
 * Elimina un archivo específico
 * @param {string} filePath - Ruta del archivo a eliminar
 * @returns {Promise<boolean>} - True si se eliminó correctamente
 */
const deleteFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`Archivo eliminado: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error al eliminar archivo: ${error.message}`);
    return false;
  }
};

/**
 * Elimina un archivo después de un tiempo determinado
 * @param {string} filePath - Ruta del archivo a eliminar
 * @param {number} delayMs - Tiempo de espera en milisegundos (default: 5 minutos)
 */
const deleteFileAfterDelay = (filePath, delayMs = 300000) => {
  setTimeout(async () => {
    await deleteFile(filePath);
  }, delayMs);
};

/**
 * Limpia todos los archivos de la carpeta tmp
 * @returns {Promise<number>} - Número de archivos eliminados
 */
const cleanTmpFolder = async () => {
  try {
    ensureTmpDir();
    const files = await fs.promises.readdir(TMP_DIR);
    let deletedCount = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;

      const filePath = path.join(TMP_DIR, file);
      const deleted = await deleteFile(filePath);
      if (deleted) deletedCount++;
    }

    console.log(`Limpieza completada: ${deletedCount} archivos eliminados`);
    return deletedCount;
  } catch (error) {
    console.error(`Error al limpiar carpeta tmp: ${error.message}`);
    return 0;
  }
};

/**
 * Genera un nombre único para el archivo
 * @param {string} extension - Extensión del archivo
 * @returns {string} - Nombre único del archivo
 */
const generateUniqueFileName = (extension = 'mp3') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `audio_${timestamp}_${random}.${extension}`;
};

/**
 * Obtiene la ruta completa en la carpeta tmp
 * @param {string} fileName - Nombre del archivo
 * @returns {string} - Ruta completa del archivo
 */
const getTmpFilePath = (fileName) => {
  return path.join(ensureTmpDir(), fileName);
};

module.exports = {
  deleteFile,
  deleteFileAfterDelay,
  cleanTmpFolder,
  ensureTmpDir,
  generateUniqueFileName,
  getTmpFilePath,
  TMP_DIR
};

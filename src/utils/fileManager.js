const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '../../..', 'tmp');

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
  return path.join(TMP_DIR, fileName);
};

module.exports = {
  deleteFile,
  deleteFileAfterDelay,
  cleanTmpFolder,
  generateUniqueFileName,
  getTmpFilePath,
  TMP_DIR
};

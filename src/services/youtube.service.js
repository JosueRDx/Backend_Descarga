const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { generateUniqueFileName, getTmpFilePath, deleteFile } = require('../utils/fileManager');

/**
 * Valida que la URL sea de YouTube
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
const isValidYoutubeUrl = (url) => {
  return ytdl.validateURL(url);
};

/**
 * Obtiene información del video de YouTube
 * @param {string} url - URL del video
 * @returns {Promise<Object>} - Información del video
 */
const getVideoInfo = async (url) => {
  try {
    const info = await ytdl.getInfo(url);
    return {
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0]?.url || null
    };
  } catch (error) {
    throw new Error(`Error al obtener información del video: ${error.message}`);
  }
};

/**
 * Descarga el audio de YouTube y lo convierte a MP3
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

  // 3. Generar nombres de archivos temporales
  const tempAudioName = generateUniqueFileName('webm');
  const mp3FileName = generateUniqueFileName('mp3');

  const tempAudioPath = getTmpFilePath(tempAudioName);
  const mp3FilePath = getTmpFilePath(mp3FileName);

  return new Promise((resolve, reject) => {
    // 4. Crear stream de descarga (solo audio)
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    // 5. Guardar audio temporal en disco
    const writeStream = fs.createWriteStream(tempAudioPath);

    audioStream.pipe(writeStream);

    // Manejar errores de descarga
    audioStream.on('error', (error) => {
      reject(new Error(`Error en descarga: ${error.message}`));
    });

    // 6. Cuando termine la descarga, convertir a MP3
    writeStream.on('finish', () => {
      console.log('Descarga completada, iniciando conversión a MP3...');

      // 7. Usar ffmpeg para convertir a MP3
      ffmpeg(tempAudioPath)
        .audioBitrate(128)
        .audioChannels(2)
        .audioFrequency(44100)
        .format('mp3')
        .on('start', (command) => {
          console.log('Comando ffmpeg:', command);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Conversión: ${Math.round(progress.percent)}%`);
          }
        })
        .on('error', async (error) => {
          // Limpiar archivo temporal en caso de error
          await deleteFile(tempAudioPath);
          reject(new Error(`Error en conversión: ${error.message}`));
        })
        .on('end', async () => {
          console.log('Conversión a MP3 completada');

          // 8. Eliminar archivo temporal (webm)
          await deleteFile(tempAudioPath);

          // 9. Retornar información del archivo convertido
          resolve({
            filePath: mp3FilePath,
            fileName: mp3FileName,
            videoInfo: videoInfo
          });
        })
        .save(mp3FilePath);
    });

    // Manejar errores de escritura
    writeStream.on('error', (error) => {
      reject(new Error(`Error al guardar audio: ${error.message}`));
    });
  });
};

module.exports = {
  isValidYoutubeUrl,
  getVideoInfo,
  downloadAndConvertToMp3
};

# Node 22: yt-dlp lo usa además como runtime de JS para resolver los retos de YouTube
FROM node:22-bookworm-slim

# Metadatos del contenedor
LABEL maintainer="JosueRDx"
LABEL description="Backend API para descarga de audio de YouTube"

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3000

# Instalar dependencias del sistema (ffmpeg para convertir a MP3, curl para bajar yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# yt-dlp: binario standalone instalado en el build
# IMPORTANTE: sube esta versión periódicamente. YouTube rompe la extracción cada
# pocas semanas y un yt-dlp viejo provoca "Requested format is not available",
# consulta la última en https://github.com/yt-dlp/yt-dlp/releases
ARG YTDLP_VERSION=2026.07.04
RUN curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" \
      -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Usar el binario instalado arriba y evitar que youtube-dl-exec baje el suyo
# El binario standalone ya incluye Python, por eso se omite su comprobación
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
ENV YOUTUBE_DL_SKIP_DOWNLOAD=true
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (optimiza caché de Docker)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el código fuente
COPY . .

# Carpeta de MP3 temporales y usuario no-root por seguridad
RUN mkdir -p /app/tmp \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser \
    && chown -R appuser:nodejs /app

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/index.js"]

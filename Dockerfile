FROM node:20-bookworm-slim

# Metadatos del contenedor
LABEL maintainer="JosueRDx"
LABEL description="Backend API para descarga de audio de YouTube"

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3000

# Instalar dependencias del sistema (ffmpeg y python3 para youtube-dl-exec/yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (optimiza caché de Docker)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar el código fuente
COPY . .

# Crear directorio temporal para descargas
RUN mkdir -p /app/temp

# Crear usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser \
    && chown -R appuser:nodejs /app

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/index.js"]

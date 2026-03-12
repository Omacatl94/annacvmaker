FROM node:20-alpine

# Chromium + fonts for server-side PDF generation
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p uploads/photos uploads/cvs && chown -R node:node uploads

USER node
EXPOSE 3000
CMD ["sh", "-c", "node server/db/migrate.js && node server/index.js"]

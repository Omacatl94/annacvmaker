FROM node:20-alpine

# Chromium + fonts for server-side PDF generation
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji su-exec

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build:client && npm prune --omit=dev
RUN mkdir -p uploads/photos uploads/cvs uploads/pdfs && chown -R node:node uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/index.js"]

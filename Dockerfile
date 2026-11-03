FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY . .

RUN npm run build

CMD ["sh", "-c", "npm run setup && npx react-router-serve ./build/server/index.js"]

FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
RUN npm run build

EXPOSE 8086

CMD ["./node_modules/.bin/tsx", "src/index.ts"]

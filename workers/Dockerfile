FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json radio-listener.mjs ./
ENV NODE_ENV=production
CMD ["node", "radio-listener.mjs"]

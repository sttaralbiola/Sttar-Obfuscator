FROM node:22-bullseye

# Luajit/Lua5.1 are needed to run Prometheus' cli.lua
RUN apt-get update && \
    apt-get install -y --no-install-recommends luajit lua5.1 git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# If the Prometheus folder isn't already committed in your repo, uncomment:
RUN git clone https://github.com/prometheus-lua/Prometheus.git Prometheus

EXPOSE 3000
CMD ["node", "server.js"]

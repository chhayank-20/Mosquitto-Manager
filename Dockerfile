# ---------- build stage ----------
FROM node:22-alpine AS build

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Backend deps
COPY app/backend/package*.json /app/backend/
RUN cd /app/backend && npm install

# Frontend deps + build
COPY app/frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm install
COPY app/frontend /app/frontend
RUN cd /app/frontend && npm run build

# Copy backend source and build
COPY app/backend /app/backend
RUN cd /app/backend && npm run build

# ---------- final stage ----------
FROM node:22-alpine

# Install mosquitto
RUN apk add --no-cache mosquitto mosquitto-clients openssl \
    && mkdir -p /mymosquitto /app/data /run

ENV DATA_DIR=/app/data

WORKDIR /app

# Copy built backend
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/package*.json /app/backend/
COPY --from=build /app/backend/node_modules /app/backend/node_modules

# Copy built frontend to backend public folder
COPY --from=build /app/frontend/dist /app/backend/public

# Copy initial data/state.json if you want default
COPY app/data /app/data

# Entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 1883 8883 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

FROM node:20-alpine AS runtime-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM heroiclabs/nakama:3.22.0

WORKDIR /nakama/data

# Copy compiled runtime module where Nakama can load it.
COPY --from=runtime-builder /app/build /nakama/data/modules/build
COPY entrypoint.sh /nakama/data/entrypoint.sh

RUN chmod +x /nakama/data/entrypoint.sh

ENTRYPOINT ["/nakama/data/entrypoint.sh"]

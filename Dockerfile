FROM node:20-alpine AS build

ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /src/app

COPY app/package.json app/yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

COPY app/ ./
RUN yarn build

FROM node:20-alpine AS runtime

WORKDIR /srv

COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

COPY server ./server
COPY --from=build /src/app/build ./public

ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/server.js"]

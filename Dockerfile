FROM node:20-alpine AS build

ENV NODE_OPTIONS=--openssl-legacy-provider

RUN npm install -g yarn@1.22.22

WORKDIR /src/app

COPY app/package.json app/yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

COPY app/ ./
RUN yarn build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/build /usr/share/nginx/html

EXPOSE 8080


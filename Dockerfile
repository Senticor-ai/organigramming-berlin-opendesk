FROM node:20-alpine AS build

ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /src/app

COPY app/package.json app/yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

COPY app/ ./
RUN yarn build

FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/build /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

USER 101

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]

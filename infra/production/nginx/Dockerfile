FROM nginx:1.28.3-alpine

RUN apk update \
  && apk upgrade --available --no-cache \
  && apk del --no-cache \
    nginx-module-acme \
    nginx-module-geoip \
    nginx-module-image-filter \
    nginx-module-njs \
    nginx-module-xslt \
    nginx \
  && apk add --no-cache 'nginx=1.28.3-r3' \
  && apk del --no-cache curl

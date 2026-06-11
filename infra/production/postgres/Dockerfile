FROM golang:1.25.11-trixie AS gosu-builder

ARG GOSU_COMMIT=6456aaa0f3c854d199d0f037f068eb97515b7513

RUN git init /src/gosu \
  && git -C /src/gosu remote add origin https://github.com/tianon/gosu.git \
  && git -C /src/gosu fetch --depth 1 origin "${GOSU_COMMIT}" \
  && git -C /src/gosu checkout --detach FETCH_HEAD \
  && cd /src/gosu \
  && CGO_ENABLED=0 go build -o /go/bin/gosu .

FROM postgres:17.10-trixie

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends pgbackrest \
  && rm -rf /var/lib/apt/lists/*

COPY --from=gosu-builder /go/bin/gosu /usr/local/bin/gosu

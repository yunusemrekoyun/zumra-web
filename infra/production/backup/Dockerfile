FROM restic/restic:0.19.0 AS restic
FROM rclone/rclone:1.74.3 AS rclone

FROM postgres:17.10-trixie

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    jq \
    pgbackrest \
  && rm -f /usr/local/bin/gosu \
  && rm -rf /var/lib/apt/lists/*

COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY infra/production/scripts /opt/zumra/scripts
RUN chmod 0755 /opt/zumra/scripts/*.sh
ENTRYPOINT ["sleep", "infinity"]

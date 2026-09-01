# syntax=docker/dockerfile:1.7
FROM maven:3.9.9-eclipse-temurin-17-alpine AS build

WORKDIR /workspace
ARG SERVICE_MODULE

COPY . .

RUN test -n "${SERVICE_MODULE}"
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn --batch-mode --no-transfer-progress \
    -pl "${SERVICE_MODULE}" -am \
    -DskipTests package
RUN set -eux; \
    jar_file="$(find "${SERVICE_MODULE}/target" -maxdepth 1 -type f -name '*.jar' -print -quit)"; \
    test -n "${jar_file}"; \
    cp "${jar_file}" /workspace/application.jar

FROM eclipse-temurin:17-jre-alpine

ARG SERVICE_NAME
ARG SERVICE_PORT=8080
ARG BUILD_REVISION=local
ARG GHCR_OWNER=local

RUN addgroup -S app && adduser -S -G app app

WORKDIR /app
COPY --from=build --chown=app:app /workspace/application.jar /app/application.jar

LABEL org.opencontainers.image.title="${SERVICE_NAME}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.source="https://github.com/${GHCR_OWNER}/food-ordering-system-ms"

ENV SERVER_PORT=${SERVICE_PORT}
EXPOSE ${SERVICE_PORT}

USER app:app

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
  CMD nc -z -w 3 127.0.0.1 "${SERVER_PORT}" || exit 1

# Kafka 3.3 falls back to the pure-Java Snappy implementation on musl/Alpine.
# Java 17 otherwise blocks the direct-buffer access required by that fallback.
ENTRYPOINT ["java", "--add-opens=java.base/java.nio=ALL-UNNAMED", "-jar", "/app/application.jar"]

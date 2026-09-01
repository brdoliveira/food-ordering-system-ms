package com.food.ordering.system.e2e.support;

import org.testcontainers.containers.ComposeContainer;
import org.testcontainers.containers.ContainerState;
import org.testcontainers.containers.wait.strategy.Wait;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class StackEnvironment implements AutoCloseable {

    private static final List<String> PUBLISHED_PORT_SERVICES = List.of(
            "postgres",
            "zookeeper",
            "kafka-broker-1",
            "kafka-broker-2",
            "kafka-broker-3",
            "schema-registry",
            "keycloak",
            "customer-service",
            "order-service",
            "payment-service",
            "restaurant-service"
    );

    private static final List<String> DIAGNOSTIC_SERVICES = List.of(
            "postgres",
            "zookeeper",
            "kafka-broker-1",
            "kafka-broker-2",
            "kafka-broker-3",
            "schema-registry",
            "init-kafka",
            "keycloak",
            "keycloak-config",
            "customer-service",
            "order-service",
            "payment-service",
            "restaurant-service"
    );

    private static final int KEYCLOAK_PORT = 8080;
    private static final int CUSTOMER_SERVICE_PORT = 8184;
    private static final int ORDER_SERVICE_PORT = 8181;
    private static final int PAYMENT_SERVICE_PORT = 8182;
    private static final int RESTAURANT_SERVICE_PORT = 8183;

    private final ComposeContainer compose;
    private final Path portOverride;
    private final Settings settings;
    private final String clientSecret;
    private final String userPassword;

    private StackEnvironment(ComposeContainer compose,
                             Path portOverride,
                             Settings settings,
                             String clientSecret,
                             String userPassword) {
        this.compose = compose;
        this.portOverride = portOverride;
        this.settings = settings;
        this.clientSecret = clientSecret;
        this.userPassword = userPassword;
    }

    public static StackEnvironment start() {
        Path repositoryRoot = locateRepositoryRoot();
        Settings settings = loadSettings();
        String runId = UUID.randomUUID().toString().replace("-", "");
        String adminPassword = "admin-" + runId;
        String clientSecret = "client-" + runId;
        String userPassword = "user-" + runId;
        String postgresPassword = "postgres-" + runId;
        Path portOverride = createPortOverride();

        List<File> composeFiles = new ArrayList<>();
        for (String relativePath : settings.composeFiles()) {
            Path composeFile = repositoryRoot.resolve(relativePath).normalize();
            if (!Files.isRegularFile(composeFile)) {
                deleteQuietly(portOverride);
                throw new IllegalStateException("Compose file not found: " + composeFile);
            }
            composeFiles.add(composeFile.toFile());
        }
        composeFiles.add(portOverride.toFile());

        Map<String, String> environment = new LinkedHashMap<>();
        environment.put("GHCR_OWNER", "e2e");
        environment.put("IMAGE_TAG", "e2e-" + runId.substring(0, 12));
        environment.put("POSTGRES_USER", "e2e");
        environment.put("POSTGRES_PASSWORD", postgresPassword);
        environment.put("POSTGRES_DB", "postgres");
        environment.put("KEYCLOAK_ADMIN", "e2e-admin");
        environment.put("KEYCLOAK_ADMIN_PASSWORD", adminPassword);
        environment.put("KEYCLOAK_REALM", settings.realm());
        environment.put("KEYCLOAK_CLIENT_ID", settings.clientId());
        environment.put("KEYCLOAK_CLIENT_SECRET", clientSecret);
        environment.put("KEYCLOAK_TEST_USER", settings.username());
        environment.put("KEYCLOAK_TEST_PASSWORD", userPassword);

        Duration startupTimeout = Duration.ofMinutes(settings.startupTimeoutMinutes());
        ComposeContainer compose = new ComposeContainer("food-ordering-e2e-", composeFiles)
                .withLocalCompose(true)
                .withBuild(true)
                .withPull(false)
                .withRemoveVolumes(true)
                .withTailChildContainers(false)
                .withStartupTimeout(startupTimeout)
                .withEnv(environment)
                .withExposedService(
                        "keycloak",
                        KEYCLOAK_PORT,
                        Wait.forHttp("/realms/" + settings.realm())
                                .forStatusCode(200)
                                .withStartupTimeout(startupTimeout))
                .withExposedService(
                        "customer-service",
                        CUSTOMER_SERVICE_PORT,
                        readinessWait(startupTimeout))
                .withExposedService(
                        "order-service",
                        ORDER_SERVICE_PORT,
                        readinessWait(startupTimeout))
                .withExposedService(
                        "payment-service",
                        PAYMENT_SERVICE_PORT,
                        readinessWait(startupTimeout))
                .withExposedService(
                        "restaurant-service",
                        RESTAURANT_SERVICE_PORT,
                        readinessWait(startupTimeout));

        try {
            compose.start();
            return new StackEnvironment(compose, portOverride, settings, clientSecret, userPassword);
        } catch (Throwable startupFailure) {
            try {
                startupFailure.addSuppressed(new IllegalStateException(collectDiagnostics(compose)));
            } catch (Throwable diagnosticFailure) {
                startupFailure.addSuppressed(diagnosticFailure);
            }
            try {
                compose.stop();
            } catch (Throwable cleanupFailure) {
                startupFailure.addSuppressed(cleanupFailure);
            }
            deleteQuietly(portOverride);
            if (startupFailure instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            if (startupFailure instanceof Error error) {
                throw error;
            }
            throw new IllegalStateException("Could not start the Compose environment", startupFailure);
        }
    }

    public URI tokenEndpoint() {
        return serviceUri("keycloak", KEYCLOAK_PORT,
                "/realms/" + settings.realm() + "/protocol/openid-connect/token");
    }

    public URI customerEndpoint() {
        return serviceUri("customer-service", CUSTOMER_SERVICE_PORT, "/customers");
    }

    public URI orderEndpoint() {
        return serviceUri("order-service", ORDER_SERVICE_PORT, "/orders");
    }

    public String realm() {
        return settings.realm();
    }

    public String clientId() {
        return settings.clientId();
    }

    public String clientSecret() {
        return clientSecret;
    }

    public String username() {
        return settings.username();
    }

    public String userPassword() {
        return userPassword;
    }

    public String tokenHost() {
        return settings.tokenHost();
    }

    public Duration projectionTimeout() {
        return Duration.ofSeconds(settings.projectionTimeoutSeconds());
    }

    public Duration sagaTimeout() {
        return Duration.ofSeconds(settings.sagaTimeoutSeconds());
    }

    public Duration pollingInterval() {
        return Duration.ofMillis(settings.pollingIntervalMillis());
    }

    public String diagnostics() {
        return collectDiagnostics(compose);
    }

    private static String collectDiagnostics(ComposeContainer compose) {
        StringBuilder diagnostics = new StringBuilder("Compose diagnostics (last 8,000 characters per service):\n");
        for (String serviceName : DIAGNOSTIC_SERVICES) {
            diagnostics.append("\n===== ").append(serviceName).append(" =====\n");
            try {
                Optional<ContainerState> container = compose.getContainerByServiceName(serviceName);
                if (container.isEmpty()) {
                    diagnostics.append("container not found\n");
                    continue;
                }
                String logs = container.get().getLogs();
                diagnostics.append(tail(logs, 8_000));
                if (!logs.endsWith("\n")) {
                    diagnostics.append('\n');
                }
            } catch (Throwable diagnosticFailure) {
                diagnostics.append("logs unavailable: ")
                        .append(diagnosticFailure.getClass().getSimpleName())
                        .append(": ")
                        .append(diagnosticFailure.getMessage())
                        .append('\n');
            }
        }
        return diagnostics.toString();
    }

    @Override
    public void close() {
        try {
            compose.stop();
        } finally {
            deleteQuietly(portOverride);
        }
    }

    private URI serviceUri(String serviceName, int servicePort, String path) {
        String host = compose.getServiceHost(serviceName, servicePort);
        if (host.contains(":") && !host.startsWith("[")) {
            host = "[" + host + "]";
        }
        int port = compose.getServicePort(serviceName, servicePort);
        return URI.create("http://" + host + ":" + port + path);
    }

    private static org.testcontainers.containers.wait.strategy.WaitStrategy readinessWait(
            Duration startupTimeout) {
        return Wait.forHttp("/actuator/health/readiness")
                .forStatusCode(200)
                .withStartupTimeout(startupTimeout);
    }

    private static Path locateRepositoryRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("pom.xml"))
                    && Files.isDirectory(current.resolve("infrastructure/docker-compose"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Could not locate repository root from " + System.getProperty("user.dir"));
    }

    private static Path createPortOverride() {
        StringBuilder override = new StringBuilder("services:\n");
        for (String service : PUBLISHED_PORT_SERVICES) {
            override.append("  ").append(service).append(":\n")
                    .append("    ports: !reset []\n");
        }
        try {
            Path file = Files.createTempFile("food-ordering-e2e-ports-", ".yml");
            Files.writeString(file, override, StandardCharsets.UTF_8);
            return file;
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not create the hermetic Compose override", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private static Settings loadSettings() {
        try (InputStream input = StackEnvironment.class.getClassLoader()
                .getResourceAsStream("application-test.yml")) {
            if (input == null) {
                throw new IllegalStateException("application-test.yml is missing from the test classpath");
            }
            Map<String, Object> root = new Yaml().load(input);
            Map<String, Object> e2e = section(root, "e2e");
            Map<String, Object> compose = section(e2e, "compose");
            Map<String, Object> keycloak = section(e2e, "keycloak");
            Map<String, Object> polling = section(e2e, "polling");

            Object fileValue = compose.get("files");
            if (!(fileValue instanceof List<?> files) || files.isEmpty()) {
                throw new IllegalStateException("e2e.compose.files must contain the Compose files");
            }
            List<String> composeFiles = files.stream().map(Objects::toString).toList();

            Settings settings = new Settings(
                    composeFiles,
                    integer(compose, "startup-timeout-minutes"),
                    string(keycloak, "realm"),
                    string(keycloak, "client-id"),
                    string(keycloak, "username"),
                    string(keycloak, "token-host"),
                    integer(polling, "projection-timeout-seconds"),
                    integer(polling, "saga-timeout-seconds"),
                    integer(polling, "interval-millis")
            );
            if (settings.sagaTimeoutSeconds() != 60) {
                throw new IllegalStateException("The saga timeout must remain exactly 60 seconds");
            }
            return settings;
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not read application-test.yml", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (!(value instanceof Map<?, ?>)) {
            throw new IllegalStateException("Missing YAML section: " + key);
        }
        return (Map<String, Object>) value;
    }

    private static int integer(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (!(value instanceof Number number) || number.intValue() <= 0) {
            throw new IllegalStateException("YAML property must be a positive integer: " + key);
        }
        return number.intValue();
    }

    private static String string(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalStateException("YAML property must be a non-blank string: " + key);
        }
        return text;
    }

    private static String tail(String value, int maximumLength) {
        if (value.length() <= maximumLength) {
            return value;
        }
        return "... output truncated ...\n" + value.substring(value.length() - maximumLength);
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // The Compose stack has already been stopped; a temp-file cleanup failure is non-fatal.
        }
    }

    private record Settings(List<String> composeFiles,
                            int startupTimeoutMinutes,
                            String realm,
                            String clientId,
                            String username,
                            String tokenHost,
                            int projectionTimeoutSeconds,
                            int sagaTimeoutSeconds,
                            int pollingIntervalMillis) {
    }
}

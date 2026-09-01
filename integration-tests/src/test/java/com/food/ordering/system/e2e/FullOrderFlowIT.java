package com.food.ordering.system.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.food.ordering.system.e2e.support.StackEnvironment;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FullOrderFlowIT {

    private static final UUID APPROVED_CUSTOMER_ID =
            UUID.fromString("d215b5f8-0249-4dc5-89a3-51fd148cfb41");
    private static final UUID CANCELLED_CUSTOMER_ID =
            UUID.fromString("d215b5f8-0249-4dc5-89a3-51fd148cfb43");
    private static final UUID RESTAURANT_ID =
            UUID.fromString("d215b5f8-0249-4dc5-89a3-51fd148cfb45");
    private static final UUID AVAILABLE_PRODUCT_ID =
            UUID.fromString("d215b5f8-0249-4dc5-89a3-51fd148cfb48");
    private static final BigDecimal PRODUCT_PRICE = new BigDecimal("50.00");
    private static final Set<String> TERMINAL_STATUSES = Set.of("APPROVED", "CANCELLED");
    private static final ObjectMapper JSON = new ObjectMapper();

    private StackEnvironment stack;
    private HttpClient http;
    private String accessToken;

    @BeforeAll
    void startHermeticStackAndAuthenticate() throws Exception {
        System.setProperty("jdk.httpclient.allowRestrictedHeaders", "host");
        stack = StackEnvironment.start();
        try {
            http = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(15))
                    .build();
            accessToken = obtainRealKeycloakToken();
        } catch (Exception | AssertionError failure) {
            failure.addSuppressed(new IllegalStateException(stack.diagnostics()));
            try {
                stack.close();
            } catch (Throwable cleanupFailure) {
                failure.addSuppressed(cleanupFailure);
            }
            stack = null;
            throw failure;
        }
    }

    @AfterAll
    void stopHermeticStack() {
        if (stack != null) {
            stack.close();
        }
    }

    @Test
    @DisplayName("@spec:AC-011 pedido válido termina APPROVED em até 60 s")
    void validOrderFinishesApprovedWithinSixtySeconds() throws Exception {
        runScenario(APPROVED_CUSTOMER_ID, "approved-customer", 1, "APPROVED");
    }

    @Test
    @DisplayName("@spec:AC-012 crédito insuficiente termina CANCELLED em até 60 s")
    void insufficientCreditFinishesCancelledWithinSixtySeconds() throws Exception {
        runScenario(CANCELLED_CUSTOMER_ID, "insufficient-credit-customer", 4, "CANCELLED");
    }

    private void runScenario(UUID customerId,
                             String username,
                             int quantity,
                             String expectedTerminalStatus) throws Exception {
        try {
            createCustomer(customerId, username);
            CreatedOrder order = createOrderWhenCustomerProjectionIsReady(customerId, quantity);
            awaitTerminalStatus(order, expectedTerminalStatus);
        } catch (Throwable failure) {
            String diagnostics = stack == null ? "Stack did not start" : stack.diagnostics();
            throw new AssertionError(
                    "E2E scenario for " + expectedTerminalStatus + " failed: " + failure.getMessage()
                            + "\n\n" + diagnostics,
                    failure);
        }
    }

    private String obtainRealKeycloakToken() throws IOException, InterruptedException {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("grant_type", "password");
        form.put("client_id", stack.clientId());
        form.put("client_secret", stack.clientSecret());
        form.put("username", stack.username());
        form.put("password", stack.userPassword());
        form.put("scope", "openid customers.write orders.write orders.read");

        HttpRequest request = HttpRequest.newBuilder(stack.tokenEndpoint())
                .timeout(Duration.ofSeconds(30))
                .header("Host", stack.tokenHost())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formEncode(form)))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                () -> "Keycloak token endpoint returned " + response.statusCode() + ": " + response.body());

        JsonNode tokenResponse = JSON.readTree(response.body());
        String token = tokenResponse.path("access_token").asText();
        assertFalse(token.isBlank(), "Keycloak response must contain a real access token");
        assertEquals(2, token.chars().filter(character -> character == '.').count(),
                "Keycloak access token must be a JWT");
        return token;
    }

    private void createCustomer(UUID customerId, String username) throws IOException, InterruptedException {
        ObjectNode body = JSON.createObjectNode()
                .put("customerId", customerId.toString())
                .put("username", username)
                .put("firstName", "E2E")
                .put("lastName", "Customer");

        HttpResponse<String> response = sendJson("POST", stack.customerEndpoint(), body, Duration.ofSeconds(15));
        assertEquals(200, response.statusCode(),
                () -> "Customer API returned " + response.statusCode() + ": " + response.body());
        JsonNode createdCustomer = JSON.readTree(response.body());
        assertEquals(customerId.toString(), createdCustomer.path("customerId").asText());
    }

    private CreatedOrder createOrderWhenCustomerProjectionIsReady(UUID customerId, int quantity)
            throws IOException, InterruptedException {
        ObjectNode orderBody = orderBody(customerId, quantity);
        Instant projectionDeadline = Instant.now().plus(stack.projectionTimeout());
        String lastResponse = "Order API was not called";

        while (Instant.now().isBefore(projectionDeadline)) {
            Instant requestStartedAt = Instant.now();
            HttpResponse<String> response = sendJson(
                    "POST",
                    stack.orderEndpoint(),
                    orderBody,
                    Duration.ofSeconds(15));
            lastResponse = response.statusCode() + ": " + response.body();
            if (response.statusCode() == 200) {
                JsonNode createdOrder = JSON.readTree(response.body());
                UUID trackingId = UUID.fromString(createdOrder.path("orderTrackingId").asText());
                assertNotNull(trackingId);
                assertEquals("PENDING", createdOrder.path("orderStatus").asText());
                return new CreatedOrder(trackingId, requestStartedAt);
            }

            boolean projectionNotReady = response.statusCode() == 400
                    && response.body().contains("Could not find customer with customer id: " + customerId);
            assertTrue(projectionNotReady,
                    "Order API rejected a valid payload for a reason other than eventual customer projection: "
                            + lastResponse);
            sleepUntilNextPoll(projectionDeadline);
        }
        throw new AssertionError("Customer projection did not become ready within "
                + stack.projectionTimeout() + "; last response: " + lastResponse);
    }

    private ObjectNode orderBody(UUID customerId, int quantity) {
        BigDecimal total = PRODUCT_PRICE.multiply(BigDecimal.valueOf(quantity));
        ObjectNode item = JSON.createObjectNode()
                .put("productId", AVAILABLE_PRODUCT_ID.toString())
                .put("quantity", quantity)
                .put("price", PRODUCT_PRICE)
                .put("subTotal", total);
        ArrayNode items = JSON.createArrayNode().add(item);
        ObjectNode address = JSON.createObjectNode()
                .put("street", "E2E Street")
                .put("postalCode", "01001000")
                .put("city", "Sao Paulo");

        ObjectNode order = JSON.createObjectNode()
                .put("customerId", customerId.toString())
                .put("restaurantId", RESTAURANT_ID.toString())
                .put("price", total);
        order.set("items", items);
        order.set("address", address);
        return order;
    }

    private void awaitTerminalStatus(CreatedOrder order, String expectedStatus)
            throws IOException, InterruptedException {
        Instant deadline = order.acceptedAt().plus(stack.sagaTimeout());
        List<String> observedStatuses = new ArrayList<>();

        while (Instant.now().isBefore(deadline)) {
            Duration remaining = Duration.between(Instant.now(), deadline);
            if (remaining.isZero() || remaining.isNegative()) {
                break;
            }
            Duration requestTimeout = remaining.compareTo(Duration.ofSeconds(10)) < 0
                    ? remaining
                    : Duration.ofSeconds(10);
            HttpResponse<String> response = sendJson(
                    "GET",
                    URI.create(stack.orderEndpoint() + "/" + order.trackingId()),
                    null,
                    requestTimeout);
            assertEquals(200, response.statusCode(),
                    () -> "Track Order API returned " + response.statusCode() + ": " + response.body());

            JsonNode trackedOrder = JSON.readTree(response.body());
            assertEquals(order.trackingId().toString(), trackedOrder.path("orderTrackingId").asText());
            String status = trackedOrder.path("orderStatus").asText();
            observedStatuses.add(status);

            Instant observedAt = Instant.now();
            if (status.equals(expectedStatus)) {
                if (!observedAt.isAfter(deadline)) {
                    return;
                }
                throw new AssertionError("Order reached " + expectedStatus + " after the 60-second deadline"
                        + "; observed statuses: " + observedStatuses);
            }
            if (TERMINAL_STATUSES.contains(status)) {
                throw new AssertionError("Order reached unexpected terminal status " + status
                        + "; observed statuses: " + observedStatuses);
            }
            sleepUntilNextPoll(deadline);
        }

        throw new AssertionError("Order " + order.trackingId() + " did not reach " + expectedStatus
                + " within " + stack.sagaTimeout() + "; observed statuses: " + observedStatuses);
    }

    private HttpResponse<String> sendJson(String method,
                                          URI uri,
                                          JsonNode body,
                                          Duration timeout) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.api.v1+json");
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private void sleepUntilNextPoll(Instant deadline) throws InterruptedException {
        long remainingMillis = Duration.between(Instant.now(), deadline).toMillis();
        if (remainingMillis <= 0) {
            return;
        }
        TimeUnit.MILLISECONDS.sleep(Math.min(stack.pollingInterval().toMillis(), remainingMillis));
    }

    private static String formEncode(Map<String, String> values) {
        return values.entrySet().stream()
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record CreatedOrder(UUID trackingId, Instant acceptedAt) {
    }
}

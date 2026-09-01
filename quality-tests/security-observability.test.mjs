import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const protectedServices = [
  {
    name: 'customer',
    security: 'customer-service/customer-container/src/main/java/com/food/ordering/system/customer/service/container/config/SecurityConfig.java',
    application: 'customer-service/customer-container/src/main/resources/application.yml',
    requiredRules: [
      /requestMatchers\(HttpMethod\.POST, "\/customers"\)\.hasAuthority\("SCOPE_customers\.write"\)/,
    ],
  },
  {
    name: 'order',
    security: 'order-service/order-container/src/main/java/com/food/ordering/system/order/service/container/config/SecurityConfig.java',
    application: 'order-service/order-container/src/main/resources/application.yml',
    requiredRules: [
      /requestMatchers\(HttpMethod\.POST, "\/orders"\)\.hasAuthority\("SCOPE_orders\.write"\)/,
      /requestMatchers\(HttpMethod\.GET, "\/orders\/\*\*"\)\.hasAuthority\("SCOPE_orders\.read"\)/,
    ],
  },
];

const observableServices = [
  ['customer', 'customer-service/customer-container'],
  ['order', 'order-service/order-container'],
  ['payment', 'payment-service/payment-container'],
  ['restaurant', 'restaurant-service/restaurant-container'],
];

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('@spec:AC-009 APIs de negócio exigem JWT válido e escopos mínimos', () => {
  for (const service of protectedServices) {
    const security = readRepositoryFile(service.security);
    const application = readRepositoryFile(service.application);

    assert.match(
      security,
      /requestMatchers\("\/actuator\/health", "\/actuator\/health\/\*\*"\)\.permitAll\(\)/,
      `${service.name}: health e probes devem continuar públicos`,
    );
    for (const requiredRule of service.requiredRules) {
      assert.match(security, requiredRule, `${service.name}: endpoint sem escopo mínimo`);
    }
    assert.match(security, /anyRequest\(\)\.authenticated\(\)/);
    assert.match(security, /oauth2ResourceServer\([^;]+\.jwt\(/s);
    assert.match(security, /SessionCreationPolicy\.STATELESS/);
    assert.doesNotMatch(security, /requestMatchers\("\/\*\*"\)\.permitAll\(\)/);
    assert.match(application, /issuer-uri: \$\{JWT_ISSUER_URI:http:\/\/localhost:8080\/realms\/food-ordering\}/);
  }
});

test('@spec:AC-010 serviços expõem saúde, prontidão, Prometheus e logs correlacionáveis sem segredos', () => {
  for (const [serviceName, containerPath] of observableServices) {
    const application = readRepositoryFile(`${containerPath}/src/main/resources/application.yml`);
    const logback = readRepositoryFile(`${containerPath}/src/main/resources/logback-spring.xml`);

    assert.match(application, new RegExp(`application:\\s*\\n\\s+name: ${serviceName}-service`));
    assert.match(application, /exposure:\s*\n\s+include: health,info,prometheus/);
    assert.match(application, /probes:\s*\n\s+enabled: true/);
    assert.match(application, /livenessstate:\s*\n\s+enabled: true/);
    assert.match(application, /readinessstate:\s*\n\s+enabled: true/);
    assert.match(application, /sampling:\s*\n\s+probability: \$\{TRACING_SAMPLING_PROBABILITY:1\.0\}/);
    assert.doesNotMatch(application, /include:.*(?:env|configprops|httpexchanges)/i);

    assert.match(logback, /source="spring\.application\.name"/);
    assert.match(logback, /%X\{traceId:-\}/);
    assert.match(logback, /%X\{spanId:-\}/);
    assert.doesNotMatch(logback, /(?:password|authorization|access[_-]?token|client[_-]?secret)\s*=/i);
  }
});

# Tasks: Resiliência e performance

> feature: resiliencia-e-performance

## T-008 — Conteinerizar serviços e compor a stack completa [concluida]
- Refs: US-005, AC-008, AC-017
- Arquivos: Dockerfile, .dockerignore, customer-service/customer-container/pom.xml, order-service/order-container/pom.xml, payment-service/payment-container/pom.xml, restaurant-service/restaurant-container/pom.xml, infrastructure/docker-compose/common.yml, infrastructure/docker-compose/zookeeper.yml, infrastructure/docker-compose/kafka_cluster.yml, infrastructure/docker-compose/init_kafka.yml, infrastructure/docker-compose/services.yml, infrastructure/docker-compose/keycloak.yml, infrastructure/keycloak/configure-realm.sh, quality-tests/container-stack.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: gerar jars executáveis, imagens não-root, healthchecks, Keycloak configurado em runtime por variáveis de ambiente e uma rede Compose coerente; não versionar segredos.

## T-009 — Proteger APIs e instrumentar os serviços [concluida]
- Refs: US-005, AC-009, AC-010
- Arquivos: customer-service/customer-container/src/main/java/com/food/ordering/system/customer/service/container/config/SecurityConfig.java, order-service/order-container/src/main/java/com/food/ordering/system/order/service/container/config/SecurityConfig.java, customer-service/customer-container/src/main/resources/application.yml, order-service/order-container/src/main/resources/application.yml, payment-service/payment-container/src/main/resources/application.yml, restaurant-service/restaurant-container/src/main/resources/application.yml, customer-service/customer-container/src/main/resources/logback-spring.xml, order-service/order-container/src/main/resources/logback-spring.xml, payment-service/payment-container/src/main/resources/logback-spring.xml, restaurant-service/restaurant-container/src/main/resources/logback-spring.xml, quality-tests/security-observability.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: depende de T-008 para as dependências Maven; usar Resource Server JWT, escopos mínimos, health público, métricas Prometheus e correlação trace/span.

## T-010 — Criar testes ponta a ponta herméticos [pendente]

- Refs: US-006, AC-011, AC-012
- Arquivos: pom.xml, integration-tests/pom.xml, integration-tests/src/test/java/com/food/ordering/system/e2e/FullOrderFlowIT.java, integration-tests/src/test/java/com/food/ordering/system/e2e/support/StackEnvironment.java, integration-tests/src/test/resources/application-test.yml, quality-tests/end-to-end.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: xalto
- Notas: depende de T-008 e T-009; controlar a stack pelo Testcontainers, obter JWT no Keycloak, provar aprovação e compensação consultando a API até o estado final.

## T-011 — Implementar smoke, carga e estresse com k6 [pendente]

- Refs: US-007, AC-013, AC-014, AC-015
- Arquivos: performance/k6/order-flow.js, performance/k6/profiles.js, performance/k6/lib/auth.js, performance/k6/lib/orders.js, performance/k6/data/orders.json, scripts/run-performance.ps1, scripts/run-performance.sh, quality-tests/performance-profiles.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: alto
- Notas: depende da stack de T-008/T-009; executar k6 por container, validar preflight, usar dados únicos e salvar resumo JSON e relatório para cada perfil.

## T-012 — Automatizar CI, desempenho e publicação de imagens [pendente]

- Refs: US-008, AC-016, AC-017
- Arquivos: .github/workflows/ci.yml, .github/workflows/performance.yml, .github/workflows/publish-images.yml, quality-tests/delivery-pipeline.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: alto
- Notas: depende de T-008 e T-011; smoke em mudanças comuns, carga/estresse por agenda ou dispatch, relatórios como artefatos e imagens GHCR com permissões mínimas.

## T-013 — Documentar segurança, observabilidade e performance [pendente]

- Refs: US-008, AC-018
- Arquivos: README.md, .env.example, quality-tests/resilience-documentation.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: medio
- Notas: depende das demais tarefas; documentar apenas comandos, limites e comportamentos comprovados.

# Tasks: Fortalecimento técnico do projeto

> feature: project-hardening

## T-001 — Tornar build, CI e repositório reproduzíveis [pendente]

- Refs: US-001, AC-001, AC-002, AC-003
- Arquivos: .mvn/wrapper/maven-wrapper.properties, mvnw, mvnw.cmd, .gitignore, .github/workflows/ci.yml, quality-tests/build-foundation.test.mjs, onpspec.config.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: instalar o Maven Wrapper oficial, validar o build completo e executar o mesmo comando na CI.

## T-002 — Externalizar configuração dos serviços [pendente]

- Refs: US-002, AC-004
- Arquivos: .env.example, customer-service/customer-container/src/main/resources/application.yml, order-service/order-container/src/main/resources/application.yml, payment-service/payment-container/src/main/resources/application.yml, restaurant-service/restaurant-container/src/main/resources/application.yml, quality-tests/runtime-configuration.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: usar placeholders do Spring com padrões de desenvolvimento, sem alterar nomes de tópicos ou portas padrão.

## T-003 — Corrigir e completar a infraestrutura local [pendente]

- Refs: US-002, AC-005
- Arquivos: infrastructure/docker-compose/common.yml, infrastructure/docker-compose/zookeeper.yml, infrastructure/docker-compose/kafka_cluster.yml, infrastructure/docker-compose/init_kafka.yml, quality-tests/local-infrastructure.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: alto
- Notas: declarar uma única rede coerente, adicionar PostgreSQL com healthcheck e provar a configuração com `docker compose config`.

## T-004 — Fortalecer invariantes monetárias [pendente]

- Refs: US-003, AC-006
- Arquivos: common/common-domain/pom.xml, common/common-domain/src/main/java/com/food/ordering/system/domain/valueobject/Money.java, common/common-domain/src/test/java/com/food/ordering/system/domain/valueobject/MoneyTest.java, quality-tests/money-domain.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: alto
- Notas: normalizar escala na construção, rejeitar nulo e cobrir igualdade e operações com testes unitários.

## T-005 — Documentar arquitetura e operação [pendente]

- Refs: US-004, AC-007
- Arquivos: README.md, quality-tests/documentation.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: documentar somente comandos e comportamentos comprovados pelas demais tarefas.

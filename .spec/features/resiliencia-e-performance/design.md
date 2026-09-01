# Design: Resiliência e performance

## Visão geral

A entrega adiciona uma stack executável por Compose e uma camada de testes que observa o sistema externamente. O caminho crítico é `Customer/Order HTTP → outbox → Kafka/Avro → Payment → Kafka → Order → Kafka → Restaurant → Kafka → Order`. O teste não substitui componentes por mocks.

## Runtime local e de CI

- Um Dockerfile multi-stage recebe o módulo executável como argumento e produz imagens Java 17 não-root.
- O Compose existente continua responsável por PostgreSQL e Kafka; arquivos adicionais incluem Keycloak e os quatro serviços.
- A configuração do realm, clientes, escopos e usuários técnicos ocorre na inicialização com valores vindos do ambiente. Nenhum segredo real entra no Git.
- Healthchecks e dependências condicionadas por saúde impedem que os testes iniciem antes da prontidão.

## Segurança

- Customer e Order atuam como OAuth2 Resource Servers e validam JWTs emitidos pelo Keycloak.
- Escopos: `customers:write`, `orders:write` e `orders:read`.
- Endpoints de negócio exigem autenticação e o escopo correspondente.
- Health/liveness/readiness permanecem públicos; métricas exigem autenticação ou ficam restritas à rede interna da stack.

## Observabilidade

- Spring Boot Actuator fornece saúde, liveness, readiness e métricas.
- Micrometer Prometheus expõe métricas para coleta.
- Micrometer Tracing injeta `traceId` e `spanId`; `logback-spring.xml` mantém esses campos em todos os serviços.
- Logs e relatórios de testes nunca imprimem tokens, senhas ou client secrets.

## Testes ponta a ponta

- Um módulo Maven `integration-tests` usa Testcontainers/Compose para controlar PostgreSQL, Kafka, Schema Registry, Keycloak e os quatro serviços.
- O teste obtém um token real, cria os dados necessários por API, envia o pedido e consulta `GET /orders/{trackingId}` até um estado terminal.
- Cenário positivo: cliente com crédito e produto disponível termina `APPROVED`.
- Cenário de compensação: cliente com crédito insuficiente termina `CANCELLED`.
- Cada cenário tem timeout máximo de 60 segundos e diagnóstico de containers em caso de falha.

## Testes de desempenho

O k6 roda em container para não exigir instalação local. Cada perfil gera um resumo JSON persistido.

| Perfil | Carga | Duração | Gate |
|---|---|---:|---|
| Smoke | 5 VUs | 30 s | erro <1%; HTTP p95 <750 ms |
| Carga | rampa 10→50 + platô 50 | 5 min + 2 min | erro <1%; HTTP p95 <750 ms; 95% das sagas ≤60 s |
| Estresse | rampa 50→150 + platô 150 | 6 min + 1 min | erro <1%; HTTP p95 <750 ms; 95% das sagas ≤60 s |

O preflight valida Docker, espaço em disco, memória, portas e prontidão. Falha de infraestrutura é distinguida de violação dos limites.

## Pipelines

- `ci.yml`: build Maven, testes de qualidade, ponta a ponta e smoke.
- `performance.yml`: agenda e `workflow_dispatch` para carga/estresse, sempre com artefatos.
- `publish-images.yml`: matriz dos quatro serviços, login no GHCR com `GITHUB_TOKEN`, tags por SHA, canal e versão.

## Decisões confirmadas

- Perfil de carga escolhido pelo usuário: opção 1.
- Autenticação local: OAuth2/JWT com Keycloak.
- Registro de imagens: GitHub Container Registry.
- Estresse completo não bloqueia toda pull request; roda por agenda ou manualmente.

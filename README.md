# Food Ordering System

Sistema de pedidos distribuído em Java/Spring Boot, organizado como módulos Maven e microsserviços. O fluxo usa PostgreSQL para persistência e Kafka/Avro para comunicação assíncrona.

## Arquitetura e módulos

- `common`: componentes compartilhados de domínio, aplicação, acesso a dados e Kafka/Avro.
- `customer-service`: cadastro de clientes e crédito.
- `order-service`: criação, outbox, saga e acompanhamento de pedidos.
- `payment-service`: processamento de pagamentos e eventos.
- `restaurant-service`: aprovação de pedidos pelo restaurante.

O caminho distribuído é `Customer/Order HTTP → outbox → Kafka/Avro → Payment → Kafka → Order → Kafka → Restaurant → Kafka → Order`.

## Pré-requisitos

Java 17, Docker com Docker Compose, Node.js 22 e acesso às dependências Maven. Use `mvnw` (Linux/macOS) ou `mvnw.cmd` (Windows), sem Maven global.

## Stack e pré-requisitos

Use Java 17, Docker Engine com Docker Compose, Node.js 22 (testes de qualidade) e acesso às dependências Maven. O repositório inclui `mvnw`/`mvnw.cmd`; não é necessário instalar Maven globalmente. Para a stack local, reserve no mínimo 4 GB de memória Docker e 2 GB livres em disco; o perfil `load` requer 5 GB livres e `stress` requer 8 GB de memória Docker e 10 GB livres.

Componentes: PostgreSQL 16, ZooKeeper, três brokers Kafka, Schema Registry, Keycloak 26 e os serviços Customer, Order, Payment e Restaurant. As portas publicadas são:

| Componente | Porta |
| --- | ---: |
| Keycloak | 8080 |
| Schema Registry | 8081 |
| Order | 8181 |
| Payment | 8182 |
| Restaurant | 8183 |
| Customer | 8184 |

## Configuração local sem segredos versionados

Copie o exemplo e edite apenas a cópia local. Os valores abaixo são credenciais descartáveis de desenvolvimento; nunca use credenciais de produção neste arquivo ou no Git.

```bash
cp .env.example .env
set -a; source .env; set +a
```

No PowerShell:

```powershell
Copy-Item .env.example .env
Get-Content .env | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object { $name, $value = $_ -split '=', 2; Set-Item "Env:$name" $value }
```

O Compose lê `.env` automaticamente. `GHCR_OWNER` identifica o namespace das imagens e `IMAGE_TAG` deve ser um SHA ou tag de versão imutável. Para desenvolvimento, use `GHCR_OWNER=local` e `IMAGE_TAG=dev`; nesse caso, construa a stack com `--build`.

## Subir e parar a stack

Valide a configuração combinada antes de iniciar:

```bash
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml config
```

Inicie todos os componentes e aguarde os healthchecks:

```bash
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml up --build --wait
```

Verifique o estado e, ao terminar, remova containers, volumes e órfãos:

```bash
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml ps
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml down --volumes --remove-orphans
```

## Autenticação Keycloak local

Ao subir a stack, `keycloak-config` cria o realm `food-ordering`, o cliente confidencial, o usuário de teste e os escopos `customers.write`, `orders.write` e `orders.read` usando as variáveis do `.env`. O endpoint público do issuer é `http://localhost:8080/realms/food-ordering`.

Obtenha um JWT de teste sem colocá-lo em arquivos ou logs:

```bash
TOKEN=$(curl --silent --fail -X POST http://localhost:8080/realms/food-ordering/protocol/openid-connect/token -H 'Host: keycloak:8080' -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "client_id=${KEYCLOAK_CLIENT_ID}" --data-urlencode "client_secret=${KEYCLOAK_CLIENT_SECRET}" --data-urlencode "username=${KEYCLOAK_TEST_USER}" --data-urlencode "password=${KEYCLOAK_TEST_PASSWORD}" --data-urlencode 'grant_type=password' | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).access_token))")
```

O header `Host: keycloak:8080` faz o token usar o mesmo issuer interno configurado nos resource servers; sem ele, um token emitido como `localhost` é corretamente rejeitado pelas APIs.

Use o token somente no header de chamadas protegidas. `POST /customers` exige `customers.write`; `POST /orders` exige `orders.write`; `GET /orders/{trackingId}` exige `orders.read`. Requisições sem JWT, com JWT inválido ou sem escopo são recusadas. Health, liveness e readiness permanecem públicos:

```bash
curl --fail http://localhost:8184/actuator/health
curl --fail http://localhost:8184/actuator/health/liveness
curl --fail http://localhost:8184/actuator/health/readiness
curl --fail -H "Authorization: Bearer ${TOKEN}" http://localhost:8181/orders/<trackingId>
```

## Observabilidade e diagnóstico

Cada microsserviço expõe Actuator em `/actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness` e `/actuator/prometheus`. Os logs estruturados incluem o nome do serviço e os campos `trace_id`/`span_id`, alimentados pelas chaves MDC `traceId`/`spanId`. Não registre headers `Authorization`, tokens, senhas ou client secrets.

Para investigar uma execução, consulte containers e logs sem imprimir variáveis sensíveis:

```bash
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml ps
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml -f infrastructure/docker-compose/keycloak.yml -f infrastructure/docker-compose/services.yml logs --tail=200 customer-service order-service payment-service restaurant-service
```

## Testes

Build e testes rápidos:

```bash
./mvnw --batch-mode test
node --test quality-tests/*.test.mjs
```

As formas equivalentes do build são `./mvnw test` e `./mvnw.cmd test`.

`quality-tests/end-to-end.test.mjs` sobe e encerra sua própria stack isolada via Testcontainers e cobre o fluxo distribuído real com PostgreSQL, Kafka, Schema Registry e Keycloak: um pedido termina em `APPROVED` e a compensação termina em `CANCELLED`, ambos com limite de 60 segundos. Execute a prova sem manter outra stack do projeto ativa:

```bash
node --test quality-tests/end-to-end.test.mjs
```

## Smoke, carga e estresse

O script executa k6 em container, faz preflight de Docker, rede, memória, disco, portas e saúde, prepara créditos isolados e grava resumo/relatório JSON em `performance/results/`. Os limites são erro HTTP < 1%, HTTP p95 < 750 ms e, quando aplicável, pelo menos 95% das sagas concluídas em até 60 s.

```bash
./scripts/run-performance.sh smoke performance/results
./scripts/run-performance.sh load performance/results
./scripts/run-performance.sh stress performance/results
```

No Windows:

```powershell
./scripts/run-performance.ps1 -Profile smoke -ResultsDirectory performance/results
./scripts/run-performance.ps1 -Profile load -ResultsDirectory performance/results
./scripts/run-performance.ps1 -Profile stress -ResultsDirectory performance/results
```

Perfis: smoke = 5 VUs por 30 s; load = rampa de 10 para 50 VUs por 5 min e platô de 50 por 2 min; stress = rampa de 50 para 150 VUs por 6 min e platô de 150 por 1 min. O nome do perfil e os relatórios JSON distinguem falha de infraestrutura de violação de limite.

## CI e publicação GHCR

`ci.yml` roda em pull requests e pushes na `main`: build Maven, testes de qualidade, stack isolada e smoke, anexando os relatórios. `performance.yml` roda apenas semanalmente (segunda-feira, 03:00 UTC) ou por `workflow_dispatch`, executando `load` e `stress` e publicando os JSON como artefatos.

`publish-images.yml` roda em push na `main` ou em tags `v*`. Com permissão mínima `contents: read` e `packages: write`, autentica no GHCR com `GITHUB_TOKEN` e publica, em matriz, `food-ordering-customer`, `food-ordering-order`, `food-ordering-payment` e `food-ordering-restaurant`. Cada imagem recebe tag longa de SHA (`sha-...`), além de `main` ou da tag de versão. Não use `latest` como referência operacional.

## API e dados de exemplo

As APIs usam `application/vnd.api.v1+json`. Os endpoints são `POST /customers`, `POST /orders` e `GET /orders/{trackingId}`. Payloads de exemplo: `json-files/customer.json` e `json-files/order.json`.

```bash
curl -X POST http://localhost:8184/customers -H 'Content-Type: application/json' -H "Authorization: Bearer ${TOKEN}" -d @json-files/customer.json
curl -X POST http://localhost:8181/orders -H 'Content-Type: application/json' -H "Authorization: Bearer ${TOKEN}" -d @json-files/order.json
curl -H "Authorization: Bearer ${TOKEN}" http://localhost:8181/orders/<trackingId>
```

## Estrutura

- `common`, `customer-service`, `order-service`, `payment-service` e `restaurant-service`: módulos de domínio e containers.
- `infrastructure/docker-compose`: PostgreSQL, Kafka, Schema Registry, Keycloak e serviços.
- `integration-tests`: testes E2E com Testcontainers.
- `performance/k6` e `scripts/run-performance.*`: perfis e execução de desempenho.
- `quality-tests`: verificações mecânicas da stack, segurança, E2E, desempenho, entrega e documentação.

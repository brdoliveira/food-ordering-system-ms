# Food Ordering System

Sistema de pedidos distribuído em Java/Spring Boot, organizado como módulos Maven e microsserviços. O fluxo usa PostgreSQL para persistência e Kafka/Avro para comunicação assíncrona.

## Arquitetura e módulos

- `common`: componentes compartilhados de domínio, aplicação, acesso a dados e Kafka.
- `customer-service`: domínio, aplicação, persistência e mensageria de clientes.
- `order-service`: criação e acompanhamento de pedidos, outbox, saga, dados e mensageria.
- `payment-service`: processamento de pagamentos e eventos.
- `restaurant-service`: aprovação de pedidos pelo restaurante.
- `infrastructure`: módulos e arquivos de infraestrutura local.

Os serviços separam domínio, aplicação, data access, mensageria e container Spring Boot. O serviço de pedidos coordena o fluxo por eventos Kafka.

## Pré-requisitos

Java 17 (o `pom.xml` fixa o release 17), Docker com Docker Compose e acesso às dependências Maven. Node.js é necessário para os testes em `quality-tests`. Use `mvnw` (Linux/macOS) ou `mvnw.cmd` (Windows), sem Maven global.

## Build e testes

```bash
./mvnw test
./mvnw.cmd test
node --test quality-tests/*.test.mjs
```

## Infraestrutura local

```bash
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml config
docker compose -f infrastructure/docker-compose/common.yml -f infrastructure/docker-compose/zookeeper.yml -f infrastructure/docker-compose/kafka_cluster.yml -f infrastructure/docker-compose/init_kafka.yml up -d
```

A composição declara PostgreSQL, ZooKeeper, três brokers Kafka e Schema Registry na rede `food-ordering-system`. Para parar, use os mesmos arquivos com `down`.

## Serviços e portas

| Serviço | Porta | Base |
| --- | ---: | --- |
| Order | 8181 | `http://localhost:8181` |
| Payment | 8182 | `http://localhost:8182` |
| Restaurant | 8183 | `http://localhost:8183` |
| Customer | 8184 | `http://localhost:8184` |

As configurações aceitam `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `KAFKA_BOOTSTRAP_SERVERS` e `KAFKA_SCHEMA_REGISTRY_URL`; consulte `.env.example`.

## API: exemplos básicos

As APIs usam `application/vnd.api.v1+json`.

```bash
curl -X POST http://localhost:8184/customers -H 'Content-Type: application/json' -d @json-files/customer.json
curl -X POST http://localhost:8181/orders -H 'Content-Type: application/json' -d @json-files/order.json
curl http://localhost:8181/orders/<trackingId>
```

Endpoints: `POST /customers`, `POST /orders` e `GET /orders/{trackingId}`. Payloads: `json-files/customer.json` e `json-files/order.json`.

# Spec: Resiliência e performance

> feature: resiliencia-e-performance
> status: pronta

## Contexto

O sistema já possui testes unitários e de integração por módulo, mas ainda não prova o fluxo distribuído completo nem possui uma linha de base mensurável de capacidade. Esta entrega cria uma stack conteinerizada, segura e observável, valida as sagas com infraestrutura isolada e automatiza smoke, carga, estresse e publicação de imagens.

## Histórias

### US-005 — Stack local reproduzível, segura e observável

Como pessoa desenvolvedora ou operadora, quero iniciar todos os componentes por containers com autenticação e sinais operacionais, para diagnosticar e testar o sistema em condições próximas das reais.

#### AC-008 — Stack completa fica pronta por um único comando

- **Dado** Docker e Docker Compose disponíveis e as variáveis obrigatórias preenchidas
- **Quando** a pessoa inicia a stack de testes
- **Então** PostgreSQL, Kafka, Schema Registry, Keycloak e os quatro microsserviços ficam saudáveis na mesma rede, sem atributos Compose obsoletos

#### AC-009 — APIs de negócio exigem tokens e escopos válidos

- **Dado** os serviços Customer e Order em execução
- **Quando** uma requisição acessa um endpoint de negócio sem JWT, com JWT inválido ou sem o escopo necessário
- **Então** o acesso é recusado, enquanto tokens emitidos pelo Keycloak com o escopo correto são aceitos e os endpoints públicos de saúde continuam acessíveis

#### AC-010 — Serviços expõem sinais operacionais correlacionáveis

- **Dado** qualquer um dos quatro microsserviços em execução
- **Quando** saúde, prontidão, métricas ou logs de uma requisição são consultados
- **Então** existem health checks, métricas Prometheus e identificadores de trace e span nos logs sem expor segredos

### US-006 — Fluxos distribuídos provados ponta a ponta

Como pessoa desenvolvedora, quero executar as sagas sobre PostgreSQL, Kafka e Schema Registry isolados, para detectar regressões que testes de módulo não enxergam.

#### AC-011 — Pedido válido termina aprovado

- **Dado** a stack isolada pronta, um cliente com crédito e um restaurante com produto disponível
- **Quando** um cliente autenticado cria um pedido válido
- **Então** o pedido percorre pagamento e aprovação do restaurante e chega ao estado `APPROVED` em até 60 segundos

#### AC-012 — Crédito insuficiente termina cancelado

- **Dado** a stack isolada pronta e um cliente cujo crédito é inferior ao total do pedido
- **Quando** um cliente autenticado cria esse pedido
- **Então** a compensação da saga é executada e o pedido chega ao estado `CANCELLED` em até 60 segundos

### US-007 — Capacidade e degradação mensuráveis

Como pessoa responsável pela confiabilidade, quero perfis repetíveis de smoke, carga e estresse, para detectar regressões e conhecer o limite operacional do fluxo de pedidos.

#### AC-013 — Smoke test protege cada mudança

- **Dado** a stack pronta e dados de teste isolados
- **Quando** 5 usuários virtuais exercitam criação e consulta de pedidos por 30 segundos
- **Então** a taxa de erro fica abaixo de 1% e a latência HTTP p95 fica abaixo de 750 ms

#### AC-014 — Carga sustentada preserva o objetivo de serviço

- **Dado** a stack pronta e dados exclusivos por usuário virtual
- **Quando** a carga cresce de 10 para 50 usuários virtuais por 5 minutos e mantém 50 por 2 minutos
- **Então** a taxa de erro fica abaixo de 1%, a latência HTTP p95 fica abaixo de 750 ms e ao menos 95% das sagas terminam em até 60 segundos

#### AC-015 — Estresse até 150 usuários mantém os limites acordados

- **Dado** a stack pronta e recursos mínimos validados pelo preflight
- **Quando** a carga cresce de 50 para 150 usuários virtuais por 6 minutos e mantém 150 por 1 minuto
- **Então** a taxa de erro fica abaixo de 1%, a latência HTTP p95 fica abaixo de 750 ms e ao menos 95% das sagas terminam em até 60 segundos, com relatório persistido como artefato

### US-008 — Entrega automatizada e verificável

Como pessoa mantenedora, quero pipelines distintos para regressão rápida, desempenho e imagens, para publicar mudanças reproduzíveis sem executar estresse em cada pull request.

#### AC-016 — CI separa regressão rápida de desempenho pesado

- **Dado** uma pull request, um push na `main` ou uma execução agendada/manual
- **Quando** os workflows são disparados
- **Então** build, testes e smoke rodam nas mudanças comuns, enquanto carga e estresse completos rodam por agenda ou acionamento manual e publicam seus relatórios

#### AC-017 — Imagens imutáveis são publicadas no GHCR

- **Dado** um push aprovado na `main` ou uma tag de versão
- **Quando** o workflow de imagens termina com sucesso
- **Então** os quatro serviços são publicados no GitHub Container Registry com tag de SHA e tags de canal ou versão apropriadas

#### AC-018 — Operação possui um runbook reproduzível

- **Dado** uma pessoa com acesso apenas ao repositório
- **Quando** ela consulta a documentação
- **Então** encontra comandos de stack, autenticação local, observabilidade, testes ponta a ponta, perfis de desempenho, requisitos de máquina, CI e publicação de imagens

## Fora de escopo

- Implantar os containers em um provedor de nuvem ou cluster Kubernetes.
- Operar um provedor de identidade de produção; o Keycloak desta entrega é apenas local e de CI.
- Garantir que o resultado local represente a capacidade de hardware de produção.
- Adicionar Grafana, Tempo ou um backend permanente de observabilidade.
- Executar o perfil completo de estresse em toda pull request.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-004 | O perfil recomendado é 5 usuários no smoke, 10→50 na carga e 50→150 no estresse, com erro <1%, HTTP p95 <750 ms e 95% das sagas em até 60 s. | confirmada | O usuário escolheu explicitamente a opção 1 em 2026-08-31. |
| ASM-005 | OAuth2/JWT com Keycloak local e publicação das imagens no GHCR são as opções desejadas. | confirmada | O usuário pediu as opções recomendadas em 2026-08-31. |
| ASM-006 | O smoke deve bloquear mudanças comuns; carga e estresse completos devem ser agendados ou manuais. | confirmada | Faz parte da opção recomendada aprovada pelo usuário. |

## Perguntas em aberto

Nenhuma.

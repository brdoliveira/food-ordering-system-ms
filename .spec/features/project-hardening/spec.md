# Spec: Fortalecimento técnico do projeto

> feature: project-hardening
> status: implementada

## Contexto

O sistema possui uma arquitetura de microsserviços completa, mas um clone novo não tem build reproduzível, automação de integração contínua, documentação operacional suficiente ou infraestrutura local completa. As configurações também repetem credenciais e endereços diretamente nos arquivos dos serviços. Esta entrega melhora a experiência de desenvolvimento e a segurança operacional sem alterar as regras de negócio nem promover uma atualização principal do stack.

## Histórias

### US-001 — Projeto reproduzível e protegido contra regressões

Como pessoa desenvolvedora, quero compilar e testar o projeto sem instalar Maven globalmente, para que o mesmo comando funcione localmente e na integração contínua.

#### AC-001 — Build completo funciona pelo Maven Wrapper

- **Dado** um clone limpo com Java 17, Docker disponível e acesso às dependências Maven
- **Quando** a pessoa executa o Maven Wrapper com a fase `test`
- **Então** todos os módulos são compilados e todos os testes terminam com sucesso sem depender de uma instalação global do Maven

#### AC-002 — Integração contínua valida cada mudança

- **Dado** um push na branch principal ou uma proposta de mudança
- **Quando** o workflow de integração contínua é iniciado
- **Então** ele configura Java 17, usa cache Maven e executa o build completo pelo Maven Wrapper

#### AC-003 — Arquivos locais e gerados ficam fora do versionamento

- **Dado** que o build, a IDE ou a infraestrutura local geraram arquivos temporários
- **Quando** o estado do repositório é consultado
- **Então** artefatos Maven, metadados comuns de IDE, arquivos de ambiente e volumes locais não aparecem como mudanças versionáveis

### US-002 — Configuração segura e portátil

Como pessoa operadora, quero configurar banco de dados e Kafka por variáveis de ambiente, para executar os serviços em ambientes diferentes sem editar ou expor credenciais no código.

#### AC-004 — Serviços aceitam configuração por ambiente

- **Dado** qualquer um dos quatro serviços executáveis
- **Quando** variáveis de ambiente de banco de dados ou Kafka são fornecidas
- **Então** o serviço usa os valores fornecidos e mantém valores locais explícitos apenas como padrão de desenvolvimento

#### AC-005 — Infraestrutura local sobe com configuração coerente

- **Dado** Docker com o plugin Compose disponível
- **Quando** os arquivos de infraestrutura são combinados e validados
- **Então** a configuração resultante contém PostgreSQL, ZooKeeper, três brokers Kafka e Schema Registry na mesma rede declarada, sem referências de rede inválidas

### US-003 — Regras monetárias confiáveis

Como pessoa desenvolvedora do domínio, quero que valores monetários sejam normalizados e nunca nulos, para evitar comparações incorretas e falhas tardias no processamento de pedidos.

#### AC-006 — Dinheiro possui invariantes explícitas

- **Dado** valores monetários equivalentes com escalas decimais diferentes ou uma tentativa de valor nulo
- **Quando** objetos `Money` são criados e comparados
- **Então** valores equivalentes são iguais, operações mantêm duas casas decimais e valores nulos são rejeitados imediatamente

### US-004 — Entrada rápida para novas pessoas

Como pessoa nova no projeto, quero entender a arquitetura e executar o ambiente por instruções verificáveis, para contribuir sem depender de conhecimento informal.

#### AC-007 — README permite compreender e executar o sistema

- **Dado** uma pessoa com acesso apenas ao repositório
- **Quando** ela consulta o README
- **Então** encontra arquitetura, módulos, pré-requisitos, comandos de build e infraestrutura, execução dos serviços, portas e exemplos básicos de API

## Fora de escopo

- Criar novos endpoints ou alterar regras de negócio dos microsserviços.
- Atualizar Spring Boot, Kafka, Avro ou outras dependências para uma nova versão principal.
- Criar imagens de produção, Kubernetes, observabilidade ou pipeline de deploy.
- Garantir compatibilidade de produção para os valores padrão locais de desenvolvimento.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | A melhoria prioritária é a fundação técnica e a experiência de desenvolvimento, não uma nova funcionalidade de negócio. | confirmada | O usuário aprovou o plano recomendado em 2026-08-31. |
| ASM-002 | Java 17 continua sendo a versão alvo do projeto. | confirmada | O `pom.xml` raiz já fixa `release` 17 e o escopo não inclui migração de runtime. |
| ASM-003 | Os testes de integração podem usar Testcontainers e exigir Docker para fornecer PostgreSQL isolado. | confirmada | O usuário autorizou explicitamente a tarefa adicional em 2026-08-31. |

## Perguntas em aberto

Nenhuma.

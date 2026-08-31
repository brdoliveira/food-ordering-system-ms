# Plano de execução — project-hardening

> gerado por `onp-spec plano` em 2026-08-31 20:48 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano project-hardening`

## Resumo — o que vai acontecer

- **5 tarefa(s) pendente(s)**: 5 em 5 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano project-hardening --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/project-hardening`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/project-hardening-faixa-1` — worktree `../onp-worktrees/food-ordering-system-ms-project-hardening-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-001 | Tornar build, CI e repositório reproduzíveis | `gpt-5.6-terra` | medium | `.mvn/wrapper/maven-wrapper.properties`, `mvnw`, `mvnw.cmd`, `.gitignore`, `.github/workflows/ci.yml`, `quality-tests/build-foundation.test.mjs`, `onpspec.config.json` |

#### faixa-2 — branch `spec/project-hardening-faixa-2` — worktree `../onp-worktrees/food-ordering-system-ms-project-hardening-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-002 | Externalizar configuração dos serviços | `gpt-5.6-terra` | medium | `.env.example`, `customer-service/customer-container/src/main/resources/application.yml`, `order-service/order-container/src/main/resources/application.yml`, `payment-service/payment-container/src/main/resources/application.yml`, `restaurant-service/restaurant-container/src/main/resources/application.yml`, `quality-tests/runtime-configuration.test.mjs` |

#### faixa-3 — branch `spec/project-hardening-faixa-3` — worktree `../onp-worktrees/food-ordering-system-ms-project-hardening-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-003 | Corrigir e completar a infraestrutura local | `gpt-5.6-terra` | high | `infrastructure/docker-compose/common.yml`, `infrastructure/docker-compose/zookeeper.yml`, `infrastructure/docker-compose/kafka_cluster.yml`, `infrastructure/docker-compose/init_kafka.yml`, `quality-tests/local-infrastructure.test.mjs` |

### Onda 2 — faixa-4 ∥ faixa-5

#### faixa-4 — branch `spec/project-hardening-faixa-4` — worktree `../onp-worktrees/food-ordering-system-ms-project-hardening-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-004 | Fortalecer invariantes monetárias | `gpt-5.6-terra` | high | `common/common-domain/pom.xml`, `common/common-domain/src/main/java/com/food/ordering/system/domain/valueobject/Money.java`, `common/common-domain/src/test/java/com/food/ordering/system/domain/valueobject/MoneyTest.java`, `quality-tests/money-domain.test.mjs` |

#### faixa-5 — branch `spec/project-hardening-faixa-5` — worktree `../onp-worktrees/food-ordering-system-ms-project-hardening-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-005 | Documentar arquitetura e operação | `gpt-5.6-luna` | low | `README.md`, `quality-tests/documentation.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/project-hardening` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify project-hardening` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/project-hardening/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/food-ordering-system-ms-project-hardening-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano project-hardening --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa project-hardening T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo project-hardening --tabela   # a tabela de andamento
onp-spec resumo project-hardening            # o resumo em texto
```


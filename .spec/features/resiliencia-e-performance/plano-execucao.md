# Plano de execução — resiliencia-e-performance

> gerado por `onp-spec plano` em 2026-09-01 01:56 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano resiliencia-e-performance --sequencial`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 6 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- tudo acontece na branch de trabalho `spec/resiliencia-e-performance`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-008 | Conteinerizar serviços e compor a stack completa | `gpt-5.6-sol` | high |
| T-009 | Proteger APIs e instrumentar os serviços | `gpt-5.6-sol` | high |
| T-010 | Criar testes ponta a ponta herméticos | `gpt-5.6-sol` | xhigh |
| T-011 | Implementar smoke, carga e estresse com k6 | `gpt-5.6-terra` | high |
| T-012 | Automatizar CI, desempenho e publicação de imagens | `gpt-5.6-terra` | high |
| T-013 | Documentar segurança, observabilidade e performance | `gpt-5.6-luna` | medium |

## Gestão de branches e commits

1. branch de trabalho `spec/resiliencia-e-performance` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify resiliencia-e-performance` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/resiliencia-e-performance/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/food-ordering-system-ms-resiliencia-e-performance-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano resiliencia-e-performance --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa resiliencia-e-performance T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo resiliencia-e-performance --tabela   # a tabela de andamento
onp-spec resumo resiliencia-e-performance            # o resumo em texto
```


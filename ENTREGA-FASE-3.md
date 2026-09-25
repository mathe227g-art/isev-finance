# iSev Finance — Fase 3

Implementação local de orçamento mensal e análise financeira sobre a estrutura existente. **Nenhuma migration ou gravação foi executada no Supabase.** As migrations das Fases 1 e 2 foram preservadas.

## O que foi implementado

- Orçamento por categoria de despesa, mês e perfil: adicionar, editar valor e excluir mediante confirmação. O banco impede duplicatas e referências a categoria de receita ou de outro perfil.
- Resumo de planejado, realizado, disponível e percentual utilizado; barras com texto/ícone para normal, próximo do limite, atingido e ultrapassado. Categorias com gastos sem orçamento também aparecem.
- Despesas fixas/variáveis classificadas explicitamente em lançamentos e recorrências. Uma recorrência pode ser variável. A classificação de regras existentes pode ser ajustada para futuras ocorrências.
- Gráficos Recharts: planejado × realizado por categoria, fixas × variáveis, evolução acumulada diária, despesas por categoria e movimentação com 7 dias, mês, 3 meses, 6 meses e ano. Valores exatos em BRL nos tooltips/tabelas acessíveis.
- Dashboard com saudação, perfil ativo, seleção direta de mês/ano, oito indicadores, orçamento, previsão transparente, próximos pagamentos/recebimentos, alertas calculados, agenda e últimas movimentações.
- Listagem paginada por vencimento para “Ver todas” das contas a pagar/receber, com filtros e ações de edição/cancelamento/exclusão existentes.
- Estados vazios, visual responsivo e permissões de interface. Sem dados fictícios no código de produção e sem nova biblioteca de gráficos.

## Páginas e estrutura

| Rota | Alteração |
|---|---|
| `/app/orcamento` | Nova página de orçamento mensal |
| `/app/pendencias` | Nova lista de contas a pagar/receber por vencimento |
| `/app` | Dashboard e análises ampliados |
| `/app/transacoes`, `/app/receitas`, `/app/despesas` | Formulário compartilhado com classificação explícita de despesas; filtros preservados |
| `/app/recorrencias` | Classificação de despesas recorrentes e ajuste de regras existentes |

Novos arquivos principais: `src/app/actions/budgets.ts`, `src/services/insights.ts`, `src/lib/insights.ts`, `src/types/insights.ts` e componentes `budget-form`, `insights`, `insight-charts` em `src/components/finance/`. Sidebar e estilos atuais foram estendidos. O código de autenticação, callback, cookies e seleção de perfis não foi refeito.

## Banco e migration

Execute **somente** [202609220003_budgets_insights.sql](supabase/migrations/202609220003_budgets_insights.sql), após revisão, no projeto Supabase existente.

- Nova tabela `monthly_budgets`: UUID, `financial_profile_id`, `category_id`, `category_kind` restrito a despesa, `month` como primeiro dia do mês, `amount NUMERIC(18,2)`, `created_at` e `updated_at TIMESTAMPTZ`.
- Restrição única `(financial_profile_id, category_id, month)`; FK composta garante categoria de despesa do mesmo perfil. Limite deve ser positivo, finito e válido. Perfil/categoria/mês são imutáveis na API; edição altera o valor.
- Coluna `expense_kind` em `transactions` e `recurring_transactions`, com `fixed` ou `variable`.
- Trigger copia a classificação da recorrência para novas ocorrências, preservando a classificação individual dos lançamentos já existentes.
- Atualização das views existentes para expor a classificação explícita; `financial_account_balances` recebe indicador de compatibilidade `phase_three_ready`, sem mudar a fórmula dos saldos.
- RPCs `finance_insights` (indicadores agregados) e `finance_due` (lista por vencimento). Ambas `SECURITY INVOKER`, utilizando RLS; nenhuma operação financeira usa `service_role`.
- Índice por perfil/mês, timestamp automático, grants por coluna e políticas RLS na tabela nova.

### Permissões

| Papel | Orçamento |
|---|---|
| Sem vínculo ou anônimo | Sem acesso |
| viewer | Leitura dos perfis autorizados |
| editor | Leitura, criação e edição |
| owner | Leitura, criação, edição e exclusão confirmada |

Server Actions validam a sessão, o papel e o perfil ativo. Formulários abertos em contexto antigo são rejeitados após troca de perfil. SQL reforça autorização e integridade, inclusive para acesso direto à API. Exclusão de orçamento preserva transações; categorias com orçamento vinculado não podem ser apagadas ou convertidas em receita.

## Aplicar manualmente

1. Abra o projeto correto no Supabase. As Fases 1 e 2 devem estar aplicadas e funcionando.
2. No **SQL Editor → New query**, cole o conteúdo integral de `202609220003_budgets_insights.sql`.
3. Execute uma única vez, incluindo `begin;` e `commit;`. Não reaplique as migrations anteriores. A migration não é um script de reexecução; se houver erro, guarde a mensagem antes de tentar novamente.
4. Recarregue `http://localhost:3000/app` e abra `http://localhost:3000/app/orcamento`.
5. Crie um orçamento no perfil de teste, registre/edite uma despesa paga e confira realizado, barra, gráfico e alerta. Troque de mês e perfil e verifique o isolamento.

**Não é necessário alterar Auth, URLs de redirecionamento, chaves ou `.env.local`.** Antes dessa migration, as telas da Fase 2 continuam disponíveis; o orçamento mostra orientação de ativação e o dashboard usa seus indicadores anteriores. A classificação nova só aparece em formulários quando a nova estrutura está disponível.

## Critérios de cálculo e decisões

- **Realizado:** despesas `completed`, agrupadas pela `transaction_date`. Pendentes, canceladas e transferências não consomem orçamento. O resumo inclui todas as despesas pagas, inclusive categorias sem limite definido; isso é indicado na tela.
- **Disponível:** orçamento planejado menos realizado. Percentual sem orçamento é `—`, não uma divisão por zero. Categorias sem orçamento exibem essa condição explicitamente.
- **Estados:** normal abaixo de 80%; atenção de 80% até abaixo de 100%; atingido em 100%; ultrapassado acima de 100%. O estado usa valores NUMERIC exatos; percentuais exibidos são arredondados a duas casas.
- **Classificação inicial:** registros existentes passam a `variable`; nenhuma recorrência é automaticamente considerada fixa. Revise os registros que devem ser fixos. Alterar uma regra afeta apenas novas ocorrências; ajuste o histórico individualmente quando necessário.
- **Fixas/variáveis:** totais, percentuais e quantidade consideram despesas pagas do mês. Recorrência e classificação são independentes.
- **Previsão:** saldo atual de todas as contas + receitas pendentes − despesas pendentes com vencimento no mês selecionado, incluindo atrasadas daquele mês. Não reconstrói saldo histórico nem prevê receitas/despesas ainda não registradas. A geração de recorrências continua explícita e limitada conforme a Fase 2.
- **Próximos pagamentos/recebimentos:** pendentes com vencimento a partir de hoje, independentemente do mês selecionado, ordenados por vencimento e limitados a cinco por seção. “Ver todas” abre a lista paginada. A agenda existente continua mostrando pendências do mês selecionado.
- **Alertas:** orçamento e resultado acompanham o mês escolhido; vencimentos da semana/atrasos usam hoje em `America/Sao_Paulo`. “Próximos 7 dias” inclui hoje e os seis dias seguintes. Não há tabela de alertas nem IA.
- **Janelas do gráfico:** referenciadas ao mês selecionado. 7 dias terminam hoje quando o mês é o atual, ou no último dia do mês escolhido. 3/6 meses incluem o mês escolhido; ano usa janeiro a dezembro desse ano. Os limites exatos aparecem no gráfico.
- **Precisão:** agregações financeiras no PostgreSQL com NUMERIC; valores via texto decimal para a interface. Conversão para `number` somente para desenho dos gráficos/barras, sem determinar saldos. Alertas usam centavos BigInt.
- **Consultas:** análises em uma RPC por carregamento do dashboard/orçamento; opções de conta/categoria em lote, contexto autenticado memoizado por requisição. Sem consultas por linha de lançamento.

## Validação realizada

- `npm test`: **37 testes aprovados**, sem falhas.
- `npm run typecheck`: sem erros.
- `npm run lint`: sem erros ou avisos. Configuração ESLint adicionada; avisos preexistentes corrigidos sem alterar regras financeiras.
- `npm run build`: build de produção aprovado, com as novas rotas.
- Testes SQL com PostgreSQL local descartável (PGlite), aplicando sequencialmente as três migrations. A suíte financeira da Fase 2 também executa sobre o schema atualizado.
- Cobertura: RLS, isolamento por usuário/perfil, viewer/editor/owner, CRUD de orçamento, duplicidade, FKs cruzadas, categorias de receita rejeitadas, valores inválidos, cálculos, transferências, fixas/variáveis, projeção, alertas, períodos vazios, orçamento sem gastos, gastos sem orçamento, ano bissexto, janelas, recorrências e regressão de edição/cancelamento/exclusão.
- Inspeção visual dos componentes reais com dados de PostgreSQL local: desktop, tablet e celular; orçamento excedido/próximo do limite, gráficos e edição em modal. Arquivos e rota temporária de inspeção removidos do projeto.
- Leitura na sessão real confirmou que a listagem existente de transações funciona antes da migration e que o orçamento mostra o estado de ativação pendente. Não houve cadastro, alteração de senha, logout ou gravação de transações reais durante os testes.
- O teste integrado completo no Supabase real da Fase 3 permanece pendente da aplicação manual. Os fluxos Auth existentes tiveram seus testes de validação mantidos, sem criar usuários reais para testes.

Migrations preservadas (SHA-256):

```text
202609220001_phase_one.sql
B36AE33E286B147E9EAC335D120F725AD622CEFFE86F27287CF51C3248AC624A

202609220002_financial_core.sql
A500C3856B86879F8B7F37129EE6E879E637F19FC4FD85E29CDBC594F8F168E7
```

Nenhum módulo de cartões, investimentos, patrimônio, metas, reserva ou calculadoras foi implementado nesta fase.

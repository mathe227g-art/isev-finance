# iSev Finance — entrega da Fase 2

Implementada no projeto existente, preservando autenticação, cookies, callback, recuperação de senha, perfis e identidade visual. Nenhuma migration ou alteração de dados foi executada no Supabase durante esta entrega. A validação financeira usa PostgreSQL local descartável (PGlite).

## 1. Funcionalidades

- Contas/carteiras: criação, edição, exclusão confirmada quando não existe histórico dependente; sete tipos e BRL. Saldo inicial editável; saldo atual/previsto calculados pelo banco.
- Categorias: criação, edição, exclusão protegida por integridade, cor, ícone e natureza receita/despesa. Sugestões adicionadas somente por ação explícita ao perfil ativo.
- Transações: receitas, despesas, transferências, edição, cancelamento e exclusão confirmada. Validação no servidor e constraints no PostgreSQL.
- Receitas: recebidas, pendentes e previstas. Despesas: pagas, pendentes, atrasadas e total previsto; abas todas/fixas/variáveis.
- Filtros por período, descrição, conta, categoria, situação, natureza e recorrência; paginação de 30 linhas. Tabelas viram cartões no celular.
- Transferência representada por uma única linha com origem e destino: inclusão/edição/cancelamento/exclusão afetam as duas contas atomicamente. Nunca compõe receita/despesa do resultado.
- Recorrências de receitas/despesas: seis frequências, intervalo inicial/final, dia de vencimento e geração explícita de previsões limitada a 366 dias por chamada e até um ano à frente.
- Dashboard: seis indicadores reais, saldo previsto, navegação mensal, seis meses de receitas × despesas, rosca por categoria, últimas movimentações e agenda dos próximos vencimentos do mês selecionado.
- Troca de perfil atualiza consultas e componentes. Formulários antigos são rejeitados se o perfil ativo mudar antes do envio.
- Confirmações destrutivas, feedback de envio/erro/sucesso, estados vazios e permissões visíveis conforme o papel.

Não há integração bancária, pagamentos, PIX, cartão, módulo de investimentos, metas, patrimônio ou módulos futuros. O tipo de conta “Investimento” é apenas classificação de carteira.

## 2–3. Migration e SQL completo

Arquivo integral, sem omissões: [202609220002_financial_core.sql](supabase/migrations/202609220002_financial_core.sql).

A migration cria `transactions` e `recurring_transactions`, três views invoker (`financial_account_balances`, `financial_transaction_feed`, `financial_recurring_feed`), três RPCs (`finance_dashboard`, `finance_transactions`, `materialize_recurring`), índices, constraints, gatilhos, grants e políticas. Reutiliza contas/categorias existentes; adiciona chave composta para natureza de categoria e políticas restritivas de exclusão.

`202609220001_phase_one.sql` não foi alterada. SHA-256 original e final: `B36AE33E286B147E9EAC335D120F725AD622CEFFE86F27287CF51C3248AC624A`.

## 4. Estrutura

- `src/app/actions/finance.ts`: mutations autenticadas, validação, autorização, confirmação e revalidação de páginas.
- `src/services/finance.ts`: contexto autenticado, leitura das views e RPCs, filtros e tratamento de indisponibilidade da Fase 2.
- `src/lib/finance.ts`: schemas Zod, datas, períodos, rótulos e valores decimais exatos.
- `src/lib/profile-access.ts`: autorização por papel e rejeição de formulário com perfil desatualizado.
- `src/lib/category-suggestions.ts`: catálogo opcional; não contém dados financeiros de demonstração.
- `src/types/finance.ts` e `src/types/database.ts`: modelos e contratos do banco.
- `src/components/finance/`: formulários, confirmações, tabelas responsivas, filtros, dashboard e Recharts.
- `src/components/app-shell.tsx`, `src/app/app/layout.tsx` e estilos globais: evolução do layout existente e atualização ao alternar perfil.
- `tests/financial-core.test.ts`: testes financeiros e RLS em PostgreSQL local; testes da Fase 1 mantidos.
- Dependência nova de produção: `recharts`. Não há dados fictícios ou rotas temporárias de revisão no código de produção.

## 5. Rotas

| Rota | Função |
|---|---|
| `/app` | Dashboard financeiro real |
| `/app/contas` | Contas, carteiras e saldos |
| `/app/categorias` | Categorias e sugestões |
| `/app/transacoes` | Todas as movimentações |
| `/app/receitas` | Receitas e filtros |
| `/app/despesas` | Despesas fixas/variáveis e filtros |
| `/app/recorrencias` | Regras, geração de previsões e cancelamento |

Todas ficam sob a proteção autenticada existente. URLs com filtros podem ser recarregadas e compartilhadas sem conceder acesso ao destinatário.

## 6. Autorização e isolamento

| Papel | Leitura | Criar/editar | Excluir permanentemente |
|---|---|---|---|
| Sem vínculo/anônimo | Não | Não | Não |
| viewer | Sim, perfis autorizados | Não | Não |
| editor | Sim | Contas, categorias, transações; criar/cancelar séries e gerar previsões | Não |
| owner | Sim | Sim | Transações avulsas e contas/categorias sem dependências |

As duas novas tabelas têm RLS. As views e RPCs financeiras são `security invoker` e respeitam o usuário autenticado. O helper privado de propriedade consulta somente o proprietário e usa `search_path` vazio. Nenhuma operação normal usa `service_role`.

O servidor deriva o contexto da sessão e do perfil validado, verifica o papel e compara o perfil submetido com o ativo. Filtra mutations por ID e perfil. O banco verifica vínculos por RLS e exige FKs compostas entre perfil, conta, categoria e recorrência. Transferências entre perfis e contas iguais são rejeitadas; categorias precisam corresponder à natureza. UUIDs, `NUMERIC(18,2)` e `timestamptz` são usados no banco. Grants por coluna impedem alterar o contexto de uma transação.

As políticas existentes da Fase 1 continuam; exclusão de conta/categoria recebe restrição adicional ao proprietário. Não foi criado gerenciamento de convites/membros na interface.

## 7–8. Validação

- `npm test`: 26 testes aprovados, sem falhas, incluindo SQL das duas migrations executado localmente.
- Cobertura: RLS por usuário/perfil, viewer/editor/owner, usuário anônimo, vínculos cruzados, troca de perfil, valores inválidos, precisão decimal, saldos, pendências, transferências, exclusões com dependências, atraso derivado, gráficos, filtros/paginação, seis frequências, fim do mês, intervalo limitado e geração idempotente.
- `npm run typecheck`: sem erros.
- `npm run build`: build de produção aprovado.
- Inspeção visual em desktop, tablet e celular: gráficos, cartões, formulários de transações/transferência/recorrência e confirmação destrutiva, usando fixtures exclusivamente em PostgreSQL local descartável. A rota temporária de inspeção foi removida.
- A integração ponta a ponta com Supabase real da Fase 2 ainda precisa ser validada após aplicação manual da migration. Não foi simulado sucesso remoto.

## 9. Decisões e limites

- `overdue` é derivado de `pending` + vencimento anterior à data atual; não é persistido. Na ausência de vencimento, utiliza a data da transação. Datas operacionais usam `America/Sao_Paulo`.
- Futuras devem permanecer pendentes. Efetivação é manual, editando a data se necessário; não há pagamento automático.
- Saldo atual é posição global disponível de todas as contas do perfil; saldo previsto soma pendências materializadas de todas as datas. Mudar mês altera receitas/despesas, resultado, vencimentos, movimentos e gráficos; não transforma o saldo atual em saldo histórico.
- Receitas/despesas e resultado do dashboard consideram somente concluídas pela data da transação. A pagar/receber usam vencimento no mês. Os filtros das listas usam data da transação.
- Dinheiro é agregado em SQL e enviado como texto decimal, evitando perda de centavos no JavaScript. Conversão numérica nos gráficos serve apenas à geometria; rótulos/tooltips usam os valores exatos.
- Recorrências não geram linhas infinitas nem usam cron: após salvar, clique em **Gerar previsões** para o intervalo desejado. Pendências não materializadas ainda não entram no saldo previsto.
- Frequências mensais ancoram no mês inicial, ajustando dias 29–31 ao último dia válido sem deslocamento cumulativo. Semanal usa o dia da semana da data inicial.
- Cancelar uma série preserva concluídos e atrasados; cancela pendentes de hoje em diante. Ocorrências são canceladas, nunca apagadas, para impedir recriação ao gerar novamente. Para mudar a regra, cancele e crie outra; lançamentos individuais podem ser editados.
- Contas/categorias com histórico ou regras vinculadas não podem ser excluídas. Alterar a natureza de categoria utilizada também é bloqueado. Excluir transação avulsa é definitivo e recalcula saldos; cancelamento preserva histórico.
- As novas dependências podem bloquear exclusão administrativa de perfil/usuário que já tenha histórico financeiro. Não foi criado fluxo de expurgo; qualquer exclusão completa posterior exige procedimento explícito e revisão das dependências.
- Antes da migration, as telas mostram uma orientação de ativação; o dashboard estrutural da Fase 1 permanece disponível. Essa orientação também pode aparecer em falhas de leitura/conexão: os logs mantêm código e mensagem do erro para diagnóstico.

## 10. Aplicação manual no Supabase

1. Revise o arquivo SQL completo vinculado acima. Confirme que está no projeto `cmzewwmierybxkhklywc` e que a Fase 1 já foi aplicada.
2. No painel Supabase, abra **SQL Editor → New query**.
3. Cole o conteúdo integral de `202609220002_financial_core.sql`, incluindo `begin;` e `commit;`.
4. Execute **somente essa nova migration**, uma vez. Ela não é um script para reaplicação. Se falhar, guarde a mensagem e não altere/reexecute a Fase 1. O bloco transacional impede aplicação parcial.
5. Após sucesso, recarregue `http://localhost:3000/app`. As variáveis atuais de `.env.local` continuam válidas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `APP_URL`. Não há variável privada nova nem mudança de Auth.
6. No perfil de teste, crie duas contas, adicione categorias e registre uma receita concluída, despesa pendente e transferência. Confirme saldos e ausência de transferência no resultado; efetive a despesa e confira a atualização.
7. Crie uma recorrência, gere o mesmo intervalo duas vezes e confira que não duplica. Troque de perfil e valide isolamento. Use outro usuário sem vínculo para confirmar ausência de acesso.

Servidor local: `npm run dev`, acesso em `http://localhost:3000`. Em uma cópia extraída do ZIP, execute `npm ci` e configure `.env.local` conforme `.env.example`; credenciais e dependências instaladas não acompanham o ZIP.

Aguardando autorização do usuário antes de qualquer alteração remota no banco.

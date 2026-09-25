# Entrega — Fase 4 do iSev Finance

Implementação concluída no projeto existente. **A migration não foi executada no Supabase.** Os módulos novos aguardam sua aplicação manual; a visão geral das fases anteriores foi conferida com a sessão existente e continua funcionando.

## 1. Funcionalidades implementadas

Cartões com limite e identificação visual; ciclos de fatura; compras em até 60 parcelas; liquidação integral de fatura; metas e histórico de aportes/retiradas; reserva de emergência; investimentos manuais, resultados e gráficos; bens/dívidas; patrimônio líquido e snapshots; resumos compactos e alertas calculados. Estados vazios usam apenas ausência de dados, sem números inventados.

## 2. Páginas novas

- `/app/cartoes`: cadastro, edição, desativação e visão de limites/faturas.
- `/app/cartoes/[id]`: competência anterior/atual/próxima, parcelas, cancelamento e registro de pagamento.
- `/app/metas`: configuração, progresso, movimentação, conclusão e arquivamento.
- `/app/reserva`: custo essencial, objetivo em meses, cobertura, aportes e retiradas.
- `/app/investimentos`: carteira manual, composição, evolução, aportes, retiradas, rendimentos/proventos reinvestidos e atualização de valor.
- `/app/posicoes/[id]`: histórico paginado de meta, reserva ou investimento.
- `/app/patrimonio`: ativos, passivos, bens/dívidas manuais, composição e evolução por snapshots.

## 3. Páginas e componentes alterados

Sidebar e breadcrumbs; `/app` com resumos e alertas; `/app/transacoes` e `/app/despesas` com compra em conta ou cartão e compras reconhecidas na listagem; formulário compartilhado de novos lançamentos; indicadores/legendas do orçamento e gráficos; `/app/contas` com efeitos das liquidações e posições; `/app/pendencias` com orientação para as faturas. A página de receitas continua usando receitas em conta.

Autenticação, cookies, callback, recuperação de senha e seletor de perfis mantêm a implementação existente. As rotas novas ficam sob o mesmo layout autenticado e a autorização também ocorre nas consultas e Server Actions.

## 4. Tabelas criadas

| Tabela | Finalidade |
|---|---|
| `credit_cards` | Configuração do cartão, conta preferencial e limite |
| `credit_card_invoices` | Ciclos, fechamento, vencimento e data de liquidação |
| `credit_card_purchases` | Compra original, categoria e classificação da despesa |
| `credit_card_installments` | Parcelas vinculadas à compra e à fatura |
| `financial_positions` | Configuração comum para metas, reserva e investimentos |
| `position_movements` | Histórico imutável e efeitos sobre cada posição |
| `cash_settlements` | Efeitos na conta sem receita/despesa de consumo |
| `net_worth_items` | Bens e dívidas manuais |
| `net_worth_snapshots` | Patrimônio calculado por dia de registro |

Todas usam UUID e `financial_profile_id`; dinheiro usa NUMERIC, timestamps usam TIMESTAMPTZ e datas financeiras civis usam DATE. FKs compostas impedem vincular contas, cartões, categorias, parcelas e posições entre perfis. Índices cobrem perfil, conta, posição, compra, competência e vencimento. Novos vínculos usam RESTRICT para preservar histórico.

## 5. Colunas adicionadas a tabelas existentes

**Nenhuma.** A nova migration cria nove tabelas e atualiza views/RPCs de consulta para centralizar os cálculos. As views existentes ganham identificação de origem/cartão e disponibilidade da Fase 4; isso não adiciona colunas às tabelas antigas. Os três arquivos SQL anteriores permanecem idênticos aos originais, verificados por SHA-256.

## 6. Regras financeiras adotadas

Detalhes em [REGRAS-FASE-4.md](REGRAS-FASE-4.md).

- Despesa de cartão reconhecida pelo **valor integral na data da compra**. Parcelamento é cronograma da dívida.
- Pagamento de fatura liquida dívida e reduz conta, sem criar outra despesa.
- Aportes debitam uma conta e creditam uma posição segregada; retiradas fazem o inverso.
- Metas, reserva e investimentos não são etiquetas sobre dinheiro que continua no saldo da conta. Não recadastre o mesmo dinheiro nos módulos manuais.
- Movimentações financeiras e parcelas preservam histórico. Configurações de posição, limites e valores de bens/dívidas podem ser editados conforme as validações.
- Valores e totais são calculados no PostgreSQL; o aplicativo recebe dinheiro como texto decimal. Conversões numéricas em gráficos servem apenas para desenho.
- Datas usam o calendário brasileiro, com `America/Sao_Paulo` para a data corrente. Datas civis não dependem de conversão de meia-noite UTC.

## 7. Cartão, fatura e parcelamento

Compra no fechamento, inclusive, entra naquele ciclo. Após o fechamento, entra no próximo. Vencimento ocorre no dia configurado estritamente após o fechamento; meses curtos ajustam ao último dia válido. Faturas já criadas preservam suas datas e cartões com histórico não permitem alterar o ciclo.

O total da compra é dividido em centavos exatos. Restos são distribuídos nas primeiras parcelas. Cada fatura soma somente suas parcelas ativas. Todas as parcelas em aberto comprometem limite; pagar uma fatura libera apenas o valor liquidado. Limite abaixo do comprometido e compra acima do disponível são rejeitados.

O cartão mostra a fatura positiva mais antiga ainda não paga. Na página de detalhes é possível navegar pelas competências e abrir o ciclo atual. Cancelar uma compra exige owner e cancela a compra inteira; se qualquer parcela tiver sido paga, a operação é bloqueada. Edição da compra e exclusão física não são oferecidas.

O pagamento integral exige owner, data após fechamento, sem data futura, e conta do mesmo perfil. A transação no banco é atômica e repetição do mesmo pagamento não duplica saída. A fatura paga informa data e conta utilizada. Não ocorre pagamento real a banco ou terceiro.

## 8. Como a dupla contagem foi evitada

`financial_reporting_transactions` reúne lançamentos anteriores e compras originais de cartão. Dashboard, orçamento e categorias usam essa fonte. `cash_settlements` não entra nessa fonte: alimenta somente saldos e liquidações. Assim, parcelas e pagamento não repetem a despesa da compra; aportes e retiradas também não aparecem como consumo ou receita operacional. Transferências entre contas mantêm as regras anteriores.

A previsão mensal da visão geral inclui faturas em aberto com vencimento no mês. A projeção **por conta** inclui pendências em conta e liquidações já registradas, mas não atribui uma fatura futura à conta preferencial, pois o usuário poderá pagar por outra conta. A agenda de pendências em conta e os alertas de fatura permanecem identificados separadamente.

## 9. Efeito dos investimentos nos indicadores

Aporte reduz conta e aumenta investimento, sem alterar patrimônio líquido. Retirada faz o inverso. Rendimento/provento reinvestido ou atualização de valor altera o valor atual e o patrimônio, sem virar receita operacional do dashboard.

`resultado = valor atual + retiradas − aportes`

`rentabilidade simples = resultado / aportes × 100`

Sem aportes, o percentual é indefinido e exibido como ausência de percentual. Não é taxa anualizada, TWR ou IRR. A evolução usa somente dias com movimentações reais; menos de dois dias mostra estado de histórico insuficiente. Os 12 tipos pedidos estão disponíveis.

## 10. Cálculo do patrimônio líquido

`ativos = contas positivas + investimentos + metas + reserva + bens manuais`

`passivos = contas negativas + todas as parcelas de cartão não pagas + dívidas manuais`

`patrimônio líquido = ativos − passivos`

Pendências comuns de caixa não são automaticamente tratadas como dívida patrimonial. O usuário deve evitar recadastrar empréstimos/bens já representados por outros registros. Snapshots são calculados pelo banco, somente para hoje, por solicitação; repetir no mesmo dia atualiza a fotografia daquele dia. Não há histórico anterior inventado.

## 11. Migration para executar manualmente

**Arquivo único:** `supabase/migrations/202609220004_wealth_cards.sql`.

No projeto Supabase já usado pela aplicação, abra SQL Editor, copie **todo o conteúdo desse arquivo**, revise e execute uma vez. Pré-requisito: Fases 1, 2 e 3 já aplicadas. O arquivo usa BEGIN/COMMIT para a atualização ser transacional. Não reaplique migrations anteriores e não execute a Fase 4 novamente após sucesso.

Nenhum SQL desta fase foi executado remotamente pelo agente. A execução SQL de validação ocorreu exclusivamente em PostgreSQL isolado via PGlite.

## 12. Configuração manual e segurança no Supabase

Além de aplicar a migration, **não é necessário mudar Auth, URLs de redirecionamento ou variáveis de ambiente**. Continue usando a URL e chave publishable já configuradas em `.env.local`; nenhuma chave privada é necessária. Aguarde a atualização do schema cache do Supabase e recarregue a aplicação após o sucesso.

As nove tabelas têm RLS de leitura por `private.can_access_profile`. Escritas diretas de authenticated/anon/PUBLIC são revogadas. RPCs de mutação verificam `auth.uid()`, `private.can_write_profile` e owner para ações sensíveis, com `search_path` vazio. Bloqueio por perfil serializa mutações da Fase 4 para evitar disputa de limite/saldo. Chaves de idempotência protegem repetição de compras e movimentações. Server Actions conferem papel e perfil ativo novamente, rejeitando formulários antigos após troca de perfil. Views executam com `security_invoker`.

Nenhum número completo de cartão, CVV, PIN ou senha é solicitado ou modelado. Últimos quatro dígitos são opcionais e validados. Não há `service_role` no aplicativo. Convites/gestão de membros continuam fora do escopo; papéis já existentes são respeitados.

Depois da aplicação, faça um teste real de cadastro de cartão, compra parcelada, liquidação de fatura já fechada, aporte/retirada e troca de perfis. A validação ponta a ponta das novas escritas no seu Supabase depende dessa etapa manual.

## 13. Qualidade e build

- `npm run build`: aprovado, todas as rotas de produção geradas.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, sem warnings.
- Interface revisada em desktop, tablet e celular; parcelas viram cards no celular e gráficos são responsivos.
- Páginas temporárias e fixtures visuais foram removidas do aplicativo. Não há dados de teste em produção.
- Visão geral autenticada real carregou com o banco ainda na Fase 3; módulos novos mostram aviso de ativação pendente.

## 14. Testes

`npm test`: **53 verificações aprovadas, zero falhas**, incluindo testes agrupadores reportados pelo Node.

Cobertura: regressão das Fases 1–3; centavos e validação monetária; cartão vazio; fechamento inclusive e virada de ciclo; meses diferentes, fevereiro bissexto e virada de ano; limite; fatura paga uma única vez; cancelamento e bloqueio após parcela paga; orçamento/categorias sem duplicação; metas, reserva, investimentos e patrimônio; snapshots; consultas completas; idempotência; bloqueio de escritas diretas; anon, viewer, editor e owner; isolamento entre usuários e entre perfis do mesmo usuário; conta/categoria de outro perfil rejeitadas.

PGlite executa PostgreSQL real em ambiente local com Auth simulado para os testes. Ele não substitui o teste final do Supabase Auth/REST real após sua aplicação manual da migration.

## 15. Limitações conhecidas

- Até 60 parcelas; sem juros, pagamento parcial, antecipação, estorno de fatura paga ou cancelamento parcial de compra.
- Ciclo não editável após existir histórico; compra deve ser cancelada e recriada quando elegível.
- Movimentos de posição não são editados/apagados e devem seguir a última data registrada. Correções usam movimentos compensatórios; valuation permite corrigir o valor atual do investimento.
- Meta só conclui com objetivo atingido; posição só arquiva com saldo zero. Uma reserva por perfil, separada de investimentos.
- Dividendos/proventos são reinvestidos; para recebê-los na conta, registre também a retirada correspondente.
- Investimentos são manuais, sem preços externos, integração com corretoras, custos fiscais, cálculo de impostos ou rentabilidade ponderada por tempo.
- Snapshots patrimoniais são manuais, sem agendamento automático. Bens/dívidas manuais têm valor atual editável, sem um livro de reavaliações individual.
- Saldo de conta pode ficar negativo, refletindo o controle cadastrado; isso entra como passivo. Não há validação de saldo bancário real.
- Totais e resumos são derivados das informações cadastradas, não auditoria bancária. Sem Open Finance, PIX, boletos, pagamentos reais ou IA financeira.

Acesso local: http://localhost:3000/app. O ZIP não inclui `.env.local`, dependências, cache de build ou arquivos temporários de revisão.

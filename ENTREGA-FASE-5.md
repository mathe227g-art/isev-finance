# iSev Finance — Fase 5

Implementada e ativada no Supabase em 24/09/2026.

## Recursos

- Central de ações com atrasos, próximos vencimentos e assinaturas.
- Indicador “Quanto posso gastar?”, com cálculo explicável e reserva do orçamento.
- Projeção do caixa registrado para 30, 60 e 90 dias.
- Comparação de receitas e despesas com o mês anterior.
- Importação CSV e OFX com prévia, confirmação, limite de 500 linhas e deduplicação no PostgreSQL.
- Relatório mensal preparado para impressão ou gravação em PDF pelo navegador.
- Controle de assinaturas sobre o mecanismo de recorrências, preservando uma única fonte para as previsões.
- Personalização dos indicadores e de sua ordem por usuário e perfil financeiro.
- Para perfis CNPJ: cadastro de clientes e fornecedores, contas a receber por cliente, equipe com acesso de contador/colaborador e histórico de atividades financeiras.

## Banco e segurança

As migrations aplicadas são:

- `20260924213950_customer_value_dashboard.sql` — preferências, lotes de importação, metadados de assinatura, deduplicação e RPCs.
- `20260924215207_security_performance_followup.sql` — índice do autor da importação e remoção do acesso externo à função administrativa `rls_auto_enable`.
- `20260924215635_business_clients_accountant_audit.sql` — contatos empresariais, vínculo de cliente em lançamentos, equipe, recebíveis agrupados e histórico de atividade.

As tabelas `dashboard_preferences` e `import_batches` têm RLS e três políticas cada. As funções novas usam `SECURITY INVOKER`: `anon` não pode executá-las; `authenticated` pode, sujeito à associação e ao papel no perfil. O arquivo bruto do extrato não é armazenado. A impressão digital da transação usa conta, data, tipo, valor e descrição normalizada, isolada pelo `financial_profile_id`.

Assinaturas criam recorrências classificadas como despesa fixa. Para refletirem no fluxo de caixa, o usuário usa a geração de previsões já disponível em Recorrências. Cancelar preserva o histórico e cancela ocorrências futuras pendentes pela regra existente.

## Formato CSV

Cabeçalhos obrigatórios: `Data`, `Descrição` e `Valor`. `Tipo` é opcional. Aceita vírgula ou ponto e vírgula, valores brasileiros e datas `DD/MM/AAAA` ou `AAAA-MM-DD`. Valor negativo representa despesa quando não existe tipo explícito.

As tabelas empresariais também usam RLS. O contador `viewer` consulta sem editar; o colaborador `editor` pode gravar; somente o proprietário administra acessos. As funções de equipe são `SECURITY DEFINER` porque consultam identidades protegidas, mas têm `search_path` vazio, bloqueiam `anon` e repetem a autorização de proprietário internamente. O log guarda somente rótulo, tipo, valor, status e papel; documentos, e-mails, telefones e observações não são copiados.

## Verificação

- 70 testes passaram, incluindo parser, atomicidade, deduplicação, RLS, papéis, equipe, recebíveis e privacidade do histórico.
- TypeScript, ESLint e build de produção passaram.
- `npm audit --omit=dev --audit-level=high` não encontrou vulnerabilidades conhecidas.
- Catálogo real: RLS ativa nas duas tabelas novas; funções novas indisponíveis para `anon`.

O teste visual autenticado final requer login manual, pois nenhuma senha foi reutilizada ou armazenada durante a entrega. A publicação Vercel continua dependendo do login do titular da conta.

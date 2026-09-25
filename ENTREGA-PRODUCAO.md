# iSev Finance — preparação de entrega

Revisão: 24/09/2026. Endereço solicitado: https://isevfinanceiro.vercel.app.
**Publicação pendente: a Vercel solicitou login. O endereço ainda não foi reservado nem validado como disponível.**

## Verificado

- 70 testes automatizados passaram, incluindo integridade financeira, importação, deduplicação, isolamento entre usuários/perfis, papéis, equipe empresarial e regressões das cinco fases. Os testes de banco usam PostgreSQL embarcado (PGlite), sem gravações no Supabase real.
- Lint e build de produção, incluindo TypeScript, passaram.
- `npm audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade conhecida na consulta realizada.
- Consulta de catálogo no Supabase real: as tabelas novas `business_contacts` e `financial_activity_log` têm RLS e políticas habilitadas; as funções empresariais negam execução a `anon`. Isso não substitui homologação com contas reais distintas.
- Dashboard autenticado carregou no navegador local.
- As migrations `customer_value_dashboard`, `security_performance_followup` e `business_clients_accountant_audit` foram executadas com sucesso no Supabase. Nenhuma migration anterior foi reaplicada.

## Correções desta revisão

- O botão de recuperação de erro usa `retry` do Next.js 16.3, que busca os dados novamente; `reset` apenas refazia a renderização.
- Consultas GET de tabelas repetem no máximo duas vezes quando o PostgREST devolve exatamente `401 / PGRST303 / JWT issued at future`. A espera total é de 1,4 segundo. Se persistir, o erro continua sendo apresentado. Não altera relógio, JWT, cookies ou RLS; não repete escritas, RPCs ou operações de autenticação.
- A tela de erro não atribui falhas genericamente a migrations e mostra referência para suporte.
- Recuperação de senha informa indisponibilidade de infraestrutura e limite de requisições, preservando resposta neutra sobre existência da conta.
- Configuração Vercel, exclusão de arquivos locais no upload e workflow de qualidade preparados. O workflow só executará quando o projeto estiver num repositório GitHub.
- Painel comercial com central de ações, capacidade de gasto, projeção de 90 dias, comparação mensal, importação CSV/OFX, assinaturas, relatório para PDF e personalização.
- Área CNPJ com clientes e fornecedores, contas a receber por cliente, acesso de contador/colaborador e histórico de atividade sem dados de contato sensíveis.
- Login com Google implementado por OAuth/PKCE no Supabase Auth, mantendo o fluxo existente de e-mail e senha. O cliente Web foi criado no projeto Google Cloud `isev-finance-509622`, o provedor está habilitado no Supabase e o Client Secret permanece somente nas configurações protegidas dos dois serviços.
- Origens OAuth autorizadas: `http://localhost:3000` e `https://isevfinanceiro.vercel.app`. Callback do Google: `https://cmzewwmierybxkhklywc.supabase.co/auth/v1/callback`. O Supabase permite os destinos `http://localhost:3000/**` e `https://isevfinanceiro.vercel.app/**`.
- Páginas públicas de Política de Privacidade (`/privacidade`) e Termos de Uso (`/termos`) preparadas para a tela de consentimento do Google.
- Tela de consentimento Google com público externo publicada em produção; o acesso não fica restrito à lista de usuários de teste. Foram solicitados somente os escopos básicos `email` e `profile`.
- PWA instalável preparada com manifesto, ícones Android/iOS, modo standalone, prompt de instalação e tela offline. O service worker guarda somente arquivos públicos; páginas autenticadas, respostas do Supabase e dados financeiros não entram no cache.

## Publicar

1. Entrar na conta Vercel que será responsável pelo cliente. Usar um projeto Next.js chamado `isevfinanceiro`, se disponível. Se importar o código por Git, usar como raiz a pasta que contém `package.json`, não a pasta externa `outputs`.
2. Usar Node.js 22, `npm ci` e `npm run build`. A configuração está em `vercel.json`.
3. Cadastrar as variáveis abaixo no ambiente Production. Os valores públicos do Supabase já estão no `.env.local` desta instalação, que não deve ser incluído no repositório nem no ZIP.

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase definitivo |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave `sb_publishable_...` desse projeto |
| `APP_URL` | `https://isevfinanceiro.vercel.app` |

Não cadastrar `service_role` ou chave privada em variáveis `NEXT_PUBLIC_*`. Não trocar o `.env.local` de desenvolvimento para a URL pública. Preview deve usar banco e URL de homologação, evitando gravar dados no banco definitivo.

4. Confirmar se o Supabase atual será o definitivo. No Auth, configurar Site URL para a origem pública e permitir exatamente `https://isevfinanceiro.vercel.app/auth/confirm` e `https://isevfinanceiro.vercel.app/auth/confirm?next=/nova-senha`. Manter localhost somente enquanto necessário para desenvolvimento. Não autorizar curingas globais de domínios de preview.
5. Publicar e verificar HTTPS, login, confirmação de cadastro, recuperação de senha e logout no endereço real. Os fluxos de e-mail precisam de uma caixa de entrada acessível para completar a homologação.

Referências: [deploy Vercel](https://vercel.com/docs/projects/deploy-from-cli), [variáveis](https://vercel.com/docs/environment-variables).

## Segurança e operação ainda pendentes

- O Security Advisor informou proteção contra senhas vazadas desativada. Ativar se disponível no plano; não foi contratado upgrade automaticamente. [Orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- O acesso externo à função administrativa `rls_auto_enable` foi removido; o aviso deixou de aparecer no Advisor sem desativar o event trigger.
- As seis RPCs de escrita da Fase 4 e três RPCs empresariais usam SECURITY DEFINER intencionalmente, com `search_path` vazio e verificação de acesso. Os testes cobrem usuários distintos e permissões. Não revogar indiscriminadamente as RPCs necessárias ao aplicativo. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- O Performance Advisor ainda aponta 11 chaves estrangeiras antigas sem índice cobrindo todas as colunas. Os índices da Fase 5 aparecem como “sem uso” imediatamente após a criação, o que é esperado antes de tráfego real. Avaliar planos com volume real antes de remover ou criar índices adicionais. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- Configurar SMTP próprio com remetente verificado e testar recebimento fora da conta do desenvolvedor. Credenciais e domínio de e-mail não foram fornecidos. O domínio `vercel.app` é endereço do aplicativo, não um domínio de remetente sob seu controle.
- Confirmar backups, retenção e responsável. Realizar restauração em projeto separado e conferir acesso, contagens e saldos antes de aceitar o procedimento. Nenhuma restauração real foi realizada nesta revisão.
- Configurar alertas de disponibilidade e acompanhar logs de erro da Vercel/Supabase; não registrar tokens, senhas, cookies ou dados financeiros em ferramentas de monitoramento.
- Definir titular das contas, faturamento, responsável pelo suporte e prazo de atendimento. MFA das contas administrativas deve ser configurado pelo titular.

Referência operacional: [checklist de produção Supabase](https://supabase.com/docs/guides/deployment/going-into-prod).

## Homologação antes de liberar ao cliente

Executar em ambiente separado com duas contas de teste: cadastro e confirmação; acesso e recuperação de senha; troca de perfil; criação e edição de receitas/despesas; transferências e saldos; recorrências; orçamento; compra parcelada e pagamento de fatura sem duplicar despesa; metas, reserva, investimentos e patrimônio. Conferir que a segunda conta não vê nem altera dados da primeira, inclusive por ID direto. Validar celular e desktop. Não usar registros financeiros reais como massa de teste.

Não comunicar como concluídas a publicação, homologação de e-mails em produção, configuração SMTP, restauração de backup ou validação de carga: essas etapas permanecem pendentes. O escopo e as limitações funcionais das fases estão nos documentos `ENTREGA-FASE-*.md` e `REGRAS-FASE-4.md`.

## Suporte e reversão

Em falha, guardar horário e referência mostrada na tela; consultar logs correspondentes sem copiar dados pessoais. Para `JWT issued at future` persistente, verificar horário dos serviços e abrir chamado Supabase com código/horário sanitizados. A retentativa não corrige divergência persistente de relógios.

Para reverter código, restaurar o deployment anterior pela Vercel. Reverter código não reverte banco. Não apagar nem reaplicar migrations como solução genérica. Fazer backup verificado antes de qualquer mudança de esquema e testar a compatibilidade do código anterior.

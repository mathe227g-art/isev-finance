# iSev Finance — Fases 1 a 5

A **Fase 5** está implementada, testada e ativada no Supabase: central de ações, capacidade de gasto, previsão de caixa, comparação mensal, importação CSV/OFX, assinaturas, relatório para PDF, painel personalizável e, em perfis CNPJ, clientes/fornecedores, recebíveis, equipe e histórico de atividade. Consulte [ENTREGA-FASE-5.md](ENTREGA-FASE-5.md).

A **Fase 4** está implementada e ativa. Consulte [ENTREGA-FASE-4.md](ENTREGA-FASE-4.md) e [REGRAS-FASE-4.md](REGRAS-FASE-4.md).

## Histórico da entrega — Fase 3

A **Fase 3** está implementada localmente: orçamento mensal, classificação explícita de despesas, dashboard e análises. Leia [ENTREGA-FASE-3.md](ENTREGA-FASE-3.md). Aplique manualmente **somente** `supabase/migrations/202609220003_budgets_insights.sql`, após as duas fases anteriores. Nenhuma migration remota foi executada pelo agente. Não é necessária alteração de Auth ou variáveis de ambiente. Validação: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Entrega anterior — Fase 2

A Fase 2 está implementada localmente. Sua ativação depende da aplicação **manual** de `supabase/migrations/202609220002_financial_core.sql`, após revisão. A migration da Fase 1 permanece inalterada e não deve ser reaplicada.

Consulte [ENTREGA-FASE-2.md](ENTREGA-FASE-2.md) para funcionalidades, estrutura, segurança, decisões, validação e instruções completas. Contas, categorias, transações, transferências, recorrências, saldos e gráficos usam PostgreSQL. Antes da nova migration, a aplicação mantém o dashboard estrutural e informa a configuração pendente.

## Documentação da entrega original — Fase 1

Aplicação Next.js 16 + React + TypeScript estrito + Tailwind CSS 4, preparada para Vercel, com PostgreSQL e Supabase Auth como backend principal.

## Entrega

- Cadastro com nome, e-mail, senha forte e confirmação de senha.
- Login e cadastro com Google via Supabase Auth e PKCE, mantendo a opção de e-mail e senha.
- Login, logout, confirmação de e-mail, solicitação de recuperação e redefinição de senha.
- Sessão persistida em cookies HTTP-only, SameSite=Lax, Secure em produção; renovação pelo Proxy do Next.js.
- Rotas `/app/*` e `/nova-senha` protegidas. Páginas e mutations sensíveis validam o usuário novamente no servidor.
- Onboarding e criação persistente de perfis CPF, CNPJ ou Outro. Não é necessário informar números de documentos.
- Listagem e seletor de perfis. A escolha usa um cookie de preferência; a autorização sempre vem do banco e da sessão.
- Sidebar, menu móvel com gerenciamento de foco, telas de acesso e dashboard responsivo usando a marca fornecida.
- Estados de carregamento, vazio, erro, sucesso e envio em andamento.
- Migration com as cinco tabelas públicas desta fase, UUIDs, timestamps, constraints, índices e RLS.
- Testes automatizados de isolamento e integridade, executando SQL em PostgreSQL via PGlite.

O dashboard usa estados vazios com “—”, sem saldos, resultados ou gráficos inventados. Nenhum dado fictício permanece no código de produção. Fixtures de teste ficam exclusivamente em `tests/`. Contas e categorias têm estrutura e políticas no banco; suas telas de gestão não fazem parte desta entrega. Não há implementação de transações, cartões, investimentos, metas, patrimônio, relatórios ou outros módulos futuros. Os itens “Em breve” da sidebar são informativos.

## Executar localmente

Requer Node.js 22.18 ou superior (validado com Node.js 24).

```sh
npm ci
```

Crie `.env.local` a partir de `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://cmzewwmierybxkhklywc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cole_a_chave_publica_fornecida
APP_URL=http://localhost:3000
```

Na pasta local entregue, `.env.local` já contém a URL e a chave pública que você enviou. Esse arquivo é ignorado pelo Git e não faz parte do ZIP. Não adicione `service_role`, `sb_secret_...`, senha do banco ou outra chave privada. A aplicação aceita apenas a chave `sb_publishable_...`.

```sh
npm run dev
```

Abra http://localhost:3000. Após a configuração abaixo, o fluxo é: cadastrar → confirmar e-mail → criar primeiro perfil → dashboard. Sem a migration, o login pode funcionar, mas o carregamento de perfis exibirá erro.

## Configurar no painel do Supabase

### 1. Aplicar a migration

Abra seu projeto → **SQL Editor** → **New query**. Execute o arquivo inteiro:

`supabase/migrations/202609220001_phase_one.sql`

O script foi feito para execução única em banco novo para este aplicativo e contém `BEGIN`/`COMMIT`. Não execute novamente sobre as mesmas tabelas nem apague tabelas existentes para forçar sua aplicação. Se preferir Supabase CLI, use `supabase link --project-ref cmzewwmierybxkhklywc` e `supabase db push` com as credenciais locais da CLI, sem adicioná-las ao aplicativo.

Tabelas públicas criadas:

| Tabela                      | Finalidade                                                           |
| --------------------------- | -------------------------------------------------------------------- |
| `profiles`                  | Nome do usuário; ID vinculado a `auth.users`                         |
| `financial_profiles`        | Nome, tipo e proprietário do contexto financeiro                     |
| `financial_profile_members` | Relação entre contexto e usuário autorizado                          |
| `accounts`                  | Estrutura inicial de contas/carteiras; saldo inicial `NUMERIC(18,2)` |
| `transaction_categories`    | Estrutura inicial de categorias por contexto                         |

`auth.users` já é gerenciada pelo Supabase Auth e não é recriada pela migration. Um trigger cria o perfil pessoal no cadastro; outro cria a associação do proprietário ao novo perfil financeiro na mesma transação. Usuários já cadastrados recebem `profiles` durante a migration. Não são criadas tabelas de módulos futuros.

### 2. Provedor e senha

Em **Authentication → Sign In / Providers → Email**, mantenha o provedor Email e **Confirm email** habilitados. Configure senha mínima de 8 caracteres com letras maiúsculas, minúsculas, números e símbolos, para combinar com a validação do aplicativo. Se sua tela de segurança oferecer proteção de senhas vazadas, habilite-a conforme o plano disponível. Ajuste os limites de requisições do Supabase Auth para o uso esperado; não desative as proteções padrão.

A consulta de configuração feita nesta entrega confirmou que Email está habilitado, novos cadastros são permitidos e a confirmação de e-mail está ativa.

O Google OAuth foi configurado no projeto Google Cloud `isev-finance-509622`, com um cliente do tipo **Aplicativo da Web**. As origens autorizadas são `http://localhost:3000` e `https://isevfinanceiro.vercel.app`; a URI de redirecionamento é `https://cmzewwmierybxkhklywc.supabase.co/auth/v1/callback`. O provedor Google está habilitado em **Authentication → Sign In / Providers**, com `Skip nonce checks` desativado. O segredo fica somente no Google Cloud e na configuração protegida do Supabase, nunca no `.env.local`, repositório ou navegador.

O Supabase também permite `http://localhost:3000/**` e `https://isevfinanceiro.vercel.app/**` como destinos pós-autenticação. As páginas públicas `/privacidade` e `/termos` atendem a tela de consentimento; publique-as junto com o aplicativo antes de colocar o consentimento OAuth em produção.

### 3. URLs

Em **Authentication → URL Configuration**:

- **Site URL** local: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/confirm`

Em produção, mude Site URL para `https://SEU-DOMINIO` e adicione `https://SEU-DOMINIO/auth/confirm` à lista permitida. Configure `APP_URL` com essa mesma origem no ambiente correspondente. Evite curingas amplos.

### 4. Templates de e-mail

O callback aceita o template padrão do Supabase com código PKCE; abra o link no mesmo navegador em que iniciou o cadastro. Para usar links com `token_hash`, inclusive entre navegadores, configure os templates abaixo em **Authentication → Email Templates**.

**Confirm signup:**

```html
<h2>Confirme seu e-mail no iSev Finance</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup"
    >Confirmar meu e-mail</a
  >
</p>
```

**Reset password:**

```html
<h2>Recupere seu acesso ao iSev Finance</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
    >Definir nova senha</a
  >
</p>
```

O callback aceita código PKCE ou `token_hash` dos tipos `signup` e `recovery`, usa a origem configurada no servidor e não aceita destinos de redirecionamento arbitrários. Após redefinir a senha, solicita encerramento global das sessões e encaminha ao login.

### 5. Entrega de e-mails

Configure **Custom SMTP** com um remetente verificado para enviar mensagens aos usuários reais. O serviço de e-mail padrão do Supabase tem restrições e limites; não presuma que ele atende um lançamento público. Use conta de teste sob seu controle para validar confirmação e recuperação, inclusive links expirados e reutilizados.

### 6. Conferir o isolamento

Após aplicar a migration, use duas contas de teste independentes. Cada uma deve enxergar apenas seus próprios perfis. Crie dois perfis na primeira conta e confira a troca pelo seletor; a segunda não deve enxergar nenhum deles. A autenticação sozinha não dá acesso aos dados dos outros usuários.

## Modelo de segurança

- RLS ativa em todas as cinco tabelas. `anon` e `PUBLIC` não recebem acesso às tabelas.
- `profiles`: leitura e alteração somente do próprio nome.
- `financial_profiles`: criação somente com proprietário igual a `auth.uid()`; alteração e exclusão somente pelo proprietário.
- Membros podem consultar somente a própria associação. Inserção/alteração/exclusão de membros são bloqueadas pela API, inclusive para o proprietário. Não há fluxo de convite/compartilhamento nesta fase.
- `accounts` e `transaction_categories`: sempre exigem `financial_profile_id`. Leitura requer associação explícita; escrita requer proprietário/editor. Viewer é somente leitura. Esses papéis preparam o esquema, sem criar compartilhamento automático.
- Nem o proprietário pode trocar `owner_id` ou mover uma conta/categoria para outro perfil pela API: os grants por coluna bloqueiam essas mudanças.
- Helpers de RLS ficam no schema `private`, com `SECURITY DEFINER`, `search_path` vazio e execução restrita. Eles usam `auth.uid()` e não recebem identidade arbitrária do cliente, evitando recursão e escalada de privilégios.
- Exclusões de usuário/perfil propagam para dependentes por FK, evitando órfãos. Não há botão de exclusão de perfil na interface nesta etapa.
- UUID selecionado em cookie é validado e consultado sob RLS; alterar o cookie não amplia acesso.
- Sem armazenamento definitivo em localStorage, JSON ou arquivos. O único estado local persistente é a sessão/preferência em cookies; os registros ficam no PostgreSQL.
- Next.js Server Actions fazem as mutations e oferecem a verificação de origem padrão. Respostas autenticadas usam `no-store`; nenhum dado privado entra em cache compartilhado.
- Headers bloqueiam enquadramento, sniffing de conteúdo e recursos de dispositivo desnecessários. Não há chave privada na aplicação.
- Para tabelas futuras, use `financial_profile_id`, FKs compostas `(financial_profile_id, account_id/category_id)` apontando para as chaves correspondentes e RLS própria em cada migration. Calcule dinheiro como decimal no banco; não faça aritmética financeira com números de ponto flutuante no JavaScript.

## Estrutura

```text
src/app/                 Rotas, layouts, Server Actions e callback de autenticação
src/components/          Formulários, dashboard, sidebar e componentes reutilizáveis
src/lib/                 Configuração, Supabase SSR e validação
src/services/            Sessão verificada e consultas de perfis
src/types/               Tipos do esquema usado pela aplicação
supabase/migrations/     Estrutura inicial, triggers, grants e políticas RLS
tests/                   Fixtures e testes isolados, sem conexão de produção
public/                  Símbolo da marca fornecido
```

## Verificação e limites

## Aplicativo instalável (PWA)

O projeto inclui manifesto, service worker, ícones para Android/iOS e botão de instalação quando o navegador disponibiliza o prompt. O PWA funciona em `localhost` durante o desenvolvimento e exige HTTPS em produção. Documentos autenticados e respostas financeiras usam a rede e não são armazenados no cache; offline, a aplicação exibe apenas uma tela pública de reconexão.

No Chrome ou Edge, use **Instalar iSev Finance** na sidebar ou o ícone de instalação na barra de endereço. No iPhone/iPad, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**.

```sh
npm test
npm run typecheck
npm run build
```

Os testes executam a migration completa em PostgreSQL via PGlite, com somente o schema de autenticação do Supabase simulado. Verificam isolamento entre usuários, anon, donos falsificados, ingresso indevido como membro, alterações de proprietário, movimentação de parent IDs, viewer e revogação, decimais e exclusão em cascata. Não são substitutos da validação final no projeto Supabase real.

Build de produção e TypeScript foram validados. A interface foi inspecionada em desktop e em viewport de celular. O dashboard foi inspecionado com fixture temporária removida antes da entrega, sem abrir as rotas autenticadas. As rotas privadas foram verificadas sem sessão.

Atualização: o usuário confirmou a aplicação da migration e a configuração do Supabase Auth. O cadastro local, a conexão ao Auth, os testes e o build foram verificados novamente. Falta o teste ponta a ponta pelo usuário com seu e-mail real, incluindo a entrega da mensagem. Nenhuma conta foi criada em seu nome, nenhuma migration remota foi executada pelo assistente e não houve publicação na Vercel.

## Vercel

Importe o repositório ou a pasta deste projeto como aplicação Next.js. Configure as três variáveis de ambiente descritas acima, usando `APP_URL` de produção. Execute o deploy somente após configurar o Supabase e conferir os fluxos. Não use `output: 'export'`: esta aplicação requer runtime de servidor para autenticação e Server Actions.

## Referências oficiais consultadas

- [Supabase: SSR com Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: autenticação por senha](https://supabase.com/docs/guides/auth/passwords)
- [Next.js: Proxy](https://nextjs.org/docs/app/getting-started/proxy)


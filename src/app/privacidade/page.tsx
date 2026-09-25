import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o iSev Finance trata dados pessoais e financeiros.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="24 de setembro de 2026">
      <section>
        <h2>1. Escopo</h2>
        <p>
          Esta política explica como o iSev Finance trata informações quando você
          cria uma conta e usa os recursos de organização financeira pessoal ou
          empresarial.
        </p>
      </section>
      <section>
        <h2>2. Dados tratados</h2>
        <p>
          Podemos tratar nome, e-mail, identificadores de autenticação, perfis
          financeiros e os dados que você registra voluntariamente, como contas,
          categorias, lançamentos, orçamentos, metas e informações de patrimônio.
          No login com Google, recebemos apenas os dados básicos autorizados por
          você, como nome, e-mail e identificador da conta.
        </p>
      </section>
      <section>
        <h2>3. Finalidades</h2>
        <p>
          Usamos os dados para autenticar sua conta, prestar os recursos do sistema,
          manter segurança e integridade, responder solicitações e melhorar a
          experiência. Não vendemos seus dados pessoais ou financeiros.
        </p>
      </section>
      <section>
        <h2>4. Armazenamento e segurança</h2>
        <p>
          A autenticação e a persistência usam Supabase Auth e PostgreSQL. O acesso
          aos registros é limitado por políticas de segurança em nível de linha e
          pelo perfil financeiro autorizado. Nenhum método elimina todos os riscos,
          mas aplicamos controles proporcionais à natureza dos dados.
        </p>
      </section>
      <section>
        <h2>5. Compartilhamento</h2>
        <p>
          Dados podem ser processados por fornecedores essenciais de infraestrutura,
          autenticação e hospedagem, dentro do necessário para operar o serviço.
          Também poderemos cumprir obrigação legal ou proteger direitos e segurança.
        </p>
      </section>
      <section>
        <h2>6. Seus direitos</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção,
          portabilidade ou exclusão de dados, observados os prazos e deveres legais.
          Também pode revogar o acesso do Google nas configurações da sua Conta
          Google e deixar de usar o login social.
        </p>
      </section>
      <section>
        <h2>7. Contato</h2>
        <p>
          Solicitações de privacidade podem ser enviadas para{" "}
          <a href="mailto:matheusgutierre2020@gmail.com">
            matheusgutierre2020@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}

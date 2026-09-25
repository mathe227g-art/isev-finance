import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Condições de uso do iSev Finance.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="24 de setembro de 2026">
      <section>
        <h2>1. Aceitação</h2>
        <p>
          Ao criar uma conta ou acessar o iSev Finance, você concorda com estes
          termos e com a Política de Privacidade. Se não concordar, não utilize o
          serviço.
        </p>
      </section>
      <section>
        <h2>2. Finalidade do serviço</h2>
        <p>
          O iSev Finance oferece ferramentas de organização e visualização
          financeira. O conteúdo apresentado é informativo e não constitui
          consultoria contábil, jurídica, tributária ou recomendação de investimento.
        </p>
      </section>
      <section>
        <h2>3. Conta e segurança</h2>
        <p>
          Você deve fornecer dados corretos, proteger seus meios de acesso e avisar
          sobre uso não autorizado. Atividades realizadas em sua sessão são de sua
          responsabilidade, salvo falha comprovada do serviço.
        </p>
      </section>
      <section>
        <h2>4. Dados inseridos</h2>
        <p>
          Você mantém a responsabilidade e os direitos sobre os dados que registra.
          Ao inseri-los, autoriza o processamento necessário para prestar o serviço e
          declara possuir permissão para tratar informações de terceiros.
        </p>
      </section>
      <section>
        <h2>5. Uso adequado</h2>
        <p>
          É proibido tentar acessar contas de terceiros, contornar controles de
          segurança, explorar vulnerabilidades, sobrecarregar a plataforma ou usar o
          serviço para atividade ilícita.
        </p>
      </section>
      <section>
        <h2>6. Disponibilidade e alterações</h2>
        <p>
          Podemos realizar manutenção, corrigir falhas e evoluir funcionalidades. Em
          situações justificadas, o acesso pode ser limitado para proteger usuários,
          dados ou a infraestrutura.
        </p>
      </section>
      <section>
        <h2>7. Encerramento</h2>
        <p>
          Você pode deixar de usar o serviço e solicitar o encerramento da conta. O
          acesso também pode ser suspenso por violação destes termos, respeitadas as
          obrigações legais de retenção e os direitos aplicáveis.
        </p>
      </section>
    </LegalPage>
  );
}

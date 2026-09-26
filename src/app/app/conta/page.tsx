import { PageHeading } from "@/components/finance/shared";
import { AccountDeleteForm } from "@/components/account-delete-form";

export default function AccountPage() {
  return (
    <>
      <PageHeading
        title="Minha conta"
        description="Gerencie os dados e o encerramento da sua conta."
      />
      <section className="panel settings-panel danger-zone">
        <h2>Excluir conta</h2>
        <AccountDeleteForm />
      </section>
    </>
  );
}

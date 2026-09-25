import { getFinanceOptions } from "@/services/finance";
import {
  PageHeading,
  PhaseTwoNotice,
  EmptyState,
  ReadOnly,
  CategoryIcon,
} from "@/components/finance/shared";
import {
  FinanceDialog,
  CategoryForm,
  CategoryDelete,
  Suggestions,
} from "@/components/finance/forms";
export default async function Categories() {
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title="Categorias"
        description={`Organize receitas e despesas de ${ctx.profile.name}.`}
      >
        {write && (
          <FinanceDialog label="Nova categoria" title="Criar categoria" primary>
            <CategoryForm profileId={ctx.profile.id} />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      {write && (
        <div className="panel suggestions-panel">
          <div>
            <h2>Um bom ponto de partida</h2>
            <p className="muted">
              Adicione sugestões como Moradia, Alimentação e Salário a este
              perfil. As categorias que já existem serão mantidas.
            </p>
          </div>
          <Suggestions profileId={ctx.profile.id} />
        </div>
      )}
      {!ctx.categories.length ? (
        <EmptyState
          title="Você ainda não possui categorias."
          description="Crie uma categoria ou use as sugestões para começar."
        />
      ) : (
        ["expense", "income"].map((kind) => (
          <section key={kind} className="category-section">
            <div className="section-heading">
              <h2>{kind === "expense" ? "Despesas" : "Receitas"}</h2>
              <span className="muted">
                {ctx.categories.filter((c) => c.kind === kind).length}{" "}
                categorias
              </span>
            </div>
            <div className="categories-grid">
              {ctx.categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <article key={c.id} className="panel category-card">
                    <div className="category-title">
                      <CategoryIcon name={c.icon} color={c.color} />
                      <h3>{c.name}</h3>
                    </div>
                    {write && (
                      <div className="row-actions">
                        <FinanceDialog label="Editar" title="Editar categoria">
                          <CategoryForm
                            profileId={ctx.profile.id}
                            category={c}
                          />
                        </FinanceDialog>
                        {ctx.role === "owner" && (
                          <CategoryDelete
                            profileId={ctx.profile.id}
                            category={c}
                          />
                        )}
                      </div>
                    )}
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

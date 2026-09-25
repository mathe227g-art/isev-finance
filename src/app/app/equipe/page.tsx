import { ShieldCheck, UserRoundCog } from "lucide-react";
import { FinanceDialog } from "@/components/finance/forms";
import { EmptyState, PageHeading } from "@/components/finance/shared";
import { RemoveTeamMember, TeamForm } from "@/components/business/forms";
import { getTeam } from "@/services/business";
import { requireFinance } from "@/services/finance";

const roles = { owner: "Proprietário", editor: "Colaborador · edição", viewer: "Contador · leitura" };
export default async function Page() {
  const [ctx, team] = await Promise.all([requireFinance(), getTeam()]);
  if (ctx.profile.kind !== "CNPJ") return <EmptyState title="Equipe do perfil" description="O compartilhamento com contador e colaboradores está disponível para perfis CNPJ."/>;
  if (ctx.role !== "owner") return <EmptyState title="Acesso da equipe" description="Somente o proprietário pode administrar quem acessa este perfil."/>;
  if (team === undefined) return <EmptyState title="Equipe aguardando ativação" description="Aplique a migration empresarial depois de revisá-la."/>;
  return <><PageHeading title="Equipe e contador" description="Conceda acesso individual e escolha quem pode apenas consultar ou também editar."><FinanceDialog primary label="Conceder acesso" title="Adicionar pessoa à equipe"><TeamForm profileId={ctx.profile.id}/></FinanceDialog></PageHeading><div className="team-grid">{team?.map((member) => <article className="panel team-card" key={member.user_id}><span className="team-avatar"><UserRoundCog size={22}/></span><div><h2>{member.full_name}</h2><p><ShieldCheck size={16}/>{roles[member.role]}</p></div>{member.role !== "owner" && <RemoveTeamMember profileId={ctx.profile.id} userId={member.user_id} name={member.full_name}/>}</article>)}</div><section className="panel access-explainer"><h2>Permissões claras</h2><p><strong>Contador · leitura:</strong> consulta dados e relatórios sem alterar registros.</p><p><strong>Colaborador · edição:</strong> inclui e atualiza dados financeiros, mas não gerencia a equipe nem exclui recursos protegidos.</p></section></>;
}

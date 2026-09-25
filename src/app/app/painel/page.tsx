import Link from "next/link";
import { PageHeading } from "@/components/finance/shared";
import { PreferencesForm } from "@/components/customer/preferences-form";
import { getCustomerDashboard } from "@/services/customer";
import { requireFinance } from "@/services/finance";
import { currentMonth } from "@/lib/finance";
export default async function Page(){const ctx=await requireFinance(),customer=await getCustomerDashboard(currentMonth());return <><PageHeading title="Personalize sua visão" description="Escolha os indicadores e a ordem em que aparecem na visão geral."/><section className="panel settings-panel">{customer?<PreferencesForm profileId={ctx.profile.id} initial={customer.widgets}/>:<><h2>O painel inteligente aguarda ativação</h2><p className="muted">Aplique a migration da Fase 5 para salvar preferências e exibir os novos indicadores.</p><Link href="/app" className="button secondary">Voltar à visão geral</Link></>}</section></>}

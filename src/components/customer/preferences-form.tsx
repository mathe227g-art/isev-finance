"use client";
import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { saveDashboardPreferences } from "@/app/actions/customer";
import { SubmitButton } from "@/components/submit-button";
import { widgetIds, type WidgetId } from "@/types/customer";
const labels: Record<WidgetId,string> = { actions:"Central de ações",safe_spend:"Quanto posso gastar?",cashflow:"Previsão de caixa 30/60/90 dias",comparison:"Comparação entre meses",subscriptions:"Assinaturas" };
export function PreferencesForm({profileId,initial}:{profileId:string;initial:WidgetId[]}) {
  const [state,action]=useActionState(saveDashboardPreferences,{}),[order,setOrder]=useState(initial);
  const toggle=(id:WidgetId)=>setOrder((current)=>current.includes(id)?current.filter((x)=>x!==id):[...current,id]);
  const move=(index:number,by:number)=>setOrder((current)=>{const next=[...current],target=index+by;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return next});
  return <form action={action} className="form-stack"><input type="hidden" name="financial_profile_id" value={profileId}/>{order.map((id)=><input key={id} type="hidden" name="widgets" value={id}/>)}<div className="widget-list">{widgetIds.map((id)=>{const index=order.indexOf(id),active=index>=0;return <div key={id} className={active?"widget-choice active":"widget-choice"}><label><input type="checkbox" checked={active} onChange={()=>toggle(id)}/><span>{labels[id]}</span></label>{active&&<div className="row-actions"><button type="button" className="icon-button" aria-label={`Subir ${labels[id]}`} onClick={()=>move(index,-1)} disabled={index===0}><ArrowUp size={17}/></button><button type="button" className="icon-button" aria-label={`Descer ${labels[id]}`} onClick={()=>move(index,1)} disabled={index===order.length-1}><ArrowDown size={17}/></button></div>}</div>})}</div>{state.error&&<p className="feedback error">{state.error}</p>}{state.success&&<p className="feedback success">{state.success}</p>}<SubmitButton>Salvar painel</SubmitButton></form>;
}

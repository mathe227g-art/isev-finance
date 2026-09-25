import "server-only";
import { cache } from "react";
import { requireFinance } from "./finance";
import type { Activity, BusinessContact, Receivable, TeamMember } from "@/types/business";
export const getBusinessSuite=cache(async()=>{const ctx=await requireFinance();if(ctx.profile.kind!=="CNPJ")return null;const [contacts,receivables,activity]=await Promise.all([
  ctx.supabase.from("business_contacts").select("*").eq("financial_profile_id",ctx.profile.id).order("active",{ascending:false}).order("name"),
  ctx.supabase.rpc("business_receivables",{p_profile:ctx.profile.id}),
  ctx.supabase.from("financial_activity_log").select("id,actor_id,action,entity,record_id,summary,created_at").eq("financial_profile_id",ctx.profile.id).order("created_at",{ascending:false}).limit(30),
]);const error=contacts.error||receivables.error||activity.error;if(error){if(["PGRST202","PGRST205","42P01","42883","42703"].includes(error.code))return undefined;throw error}return {contacts:contacts.data as BusinessContact[],receivables:receivables.data as Receivable[],activity:activity.data as Activity[]}});
export const getTeam=cache(async()=>{const ctx=await requireFinance();if(ctx.role!=="owner")return null;const {data,error}=await ctx.supabase.rpc("profile_team",{p_profile:ctx.profile.id});if(error){if(["PGRST202","42883"].includes(error.code))return undefined;throw error}return data as TeamMember[]});

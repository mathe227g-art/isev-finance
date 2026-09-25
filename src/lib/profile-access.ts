import type {Role} from '../types/finance';
export function authorizeFinanceWrite(role:Role,activeProfileId:string,submittedProfileId:FormDataEntryValue|null,ownerOnly=false){
  if(submittedProfileId!==activeProfileId)throw new Error('O perfil ativo mudou. Recarregue a página antes de salvar.');
  if(role==='viewer'||(ownerOnly&&role!=='owner'))throw new Error('Seu acesso não permite esta ação.');
}

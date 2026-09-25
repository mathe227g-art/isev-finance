export type BusinessContact={id:string;financial_profile_id:string;kind:"client"|"supplier"|"both";name:string;document:string;email:string;phone:string;notes:string;active:boolean;created_at:string;updated_at:string};
export type Receivable={id:string;name:string;items:number;total:string;next_due:string};
export type Activity={id:number;financial_profile_id:string;actor_id:string|null;action:string;entity:string;record_id:string|null;summary:{label?:string;type?:string;amount?:string;status?:string;role?:string};created_at:string};
export type TeamMember={user_id:string;role:"owner"|"editor"|"viewer";full_name:string};

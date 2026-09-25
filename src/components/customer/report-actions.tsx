"use client";
import { Download } from "lucide-react";
export function ReportActions(){return <button className="button primary no-print" onClick={()=>window.print()}><Download size={17}/> Salvar em PDF</button>}

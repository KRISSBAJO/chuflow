"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { FinanceReviewControls } from "./finance-review-controls";
import type { OfferingEntrySummary } from "@/lib/types";
export function OfferingReviewQueue(){
 const t=useTranslations('admin.financeReview');const [items,setItems]=useState<OfferingEntrySummary[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;apiGet<{items:OfferingEntrySummary[]}>('/finance/offerings?status=submitted&limit=50').then(data=>{if(alive)setItems(data.items);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 return <div className="space-y-3">{error&&<p role="alert">{error}</p>}{items.map(item=><div key={item._id} className="rounded-xl border p-4"><Link href="/finance?tab=offerings">{item.offeringTypeLabel} · {item.amount} {item.currency} · {item.serviceDate?.slice(0,10)}</Link><p className="text-sm">{t('independent')}</p><FinanceReviewControls id={item._id} status={item.status} canReview={item.permissions?.canReview} reviewRevision={item.reviewRevision} onReviewed={()=>setItems(current=>current.filter(row=>row._id!==item._id))}/></div>)}</div>;
}

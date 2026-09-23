import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileText, RotateCcw } from "lucide-react";
import type { TransactionStatus, TransactionType } from "@/lib/types";

export function formatMoney(value: number, decimals = 0) {
  return `₦${Math.abs(value).toLocaleString("en-NG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
export function signedMoney(value: number, decimals = 0) {
  return `${value < 0 ? "−" : ""}${formatMoney(value, decimals)}`;
}
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", options || { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}
export function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join(""); }
export function reportUrl(report: string, from: string, to: string) {
  return `/api/export?report=${encodeURIComponent(report)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}
export function typeLabel(type: TransactionType) {
  return ({ income: "Income", expense: "Expense", transfer: "Transfer", journal: "Journal", reversal: "Reversal" })[type];
}
export function TypeIcon({ type, size = 17 }: { type: TransactionType; size?: number }) {
  if (type === "income") return <ArrowDownLeft size={size} />;
  if (type === "expense") return <ArrowUpRight size={size} />;
  if (type === "transfer") return <ArrowLeftRight size={size} />;
  if (type === "reversal") return <RotateCcw size={size} />;
  return <FileText size={size} />;
}
export function StatusPill({ status }: { status: TransactionStatus }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{status === "reversed" ? "Reversed" : status === "draft" ? "Draft" : "Posted"}</span>;
}
export function PageIntro({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return <div className="page-intro"><div><div className="page-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-state"><div className="empty-state-icon">{icon}</div><h3>{title}</h3><p>{description}</p></div>;
}

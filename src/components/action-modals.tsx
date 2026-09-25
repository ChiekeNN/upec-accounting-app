"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, BookOpen, CircleAlert, Plus, Trash2, X } from "lucide-react";
import type { AccountCategory, Snapshot, TransactionItem } from "@/lib/types";
import { assignableRoles, isOwner, roleLabel, roleSummary, type Role } from "@/lib/roles";
import { formatMoney } from "@/components/finance-ui";

type ModalKind = "transaction" | "account" | "budget" | "user";
type Action = (payload: Record<string, unknown>) => Promise<boolean>;
type EntryType = "income" | "expense" | "transfer" | "journal";

function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  return <div className="modal-layer"><div className="modal-backdrop" onClick={onClose} /><div className={`modal-card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-close" aria-label="Close form" onClick={onClose}><X size={20} /></button></div>{children}</div></div>;
}

type JournalDraft = { accountId: string; debit: string; credit: string; memo: string };
type EntryDraft = {
  type: EntryType; date: string; description: string; payee: string; paymentMethod: string;
  amount: string; categoryAccountId: string; cashAccountId: string;
  fromAccountId: string; toAccountId: string; lines: JournalDraft[];
};

/**
 * Starting values for the entry form. When correcting an existing draft, the
 * accounts and amount are read back out of its stored journal lines so the form
 * opens showing exactly what was saved.
 */
function initialEntry(draft: TransactionItem | undefined, data: Snapshot, defaultCash: string, defaultOtherAsset: string): EntryDraft {
  const firstExpense = data.accounts.find((item) => item.category === "expense")?.id || "";
  const blank: EntryDraft = {
    type: "expense", date: new Date().toISOString().slice(0, 10), description: "", payee: "",
    paymentMethod: "Bank transfer", amount: "", categoryAccountId: firstExpense, cashAccountId: defaultCash,
    fromAccountId: defaultCash, toAccountId: defaultOtherAsset,
    lines: [{ accountId: firstExpense, debit: "", credit: "", memo: "" }, { accountId: defaultCash, debit: "", credit: "", memo: "" }],
  };
  if (!draft) return blank;
  const shared = { date: draft.date, description: draft.description, payee: draft.payee, paymentMethod: draft.paymentMethod };
  const debitLine = draft.lines.find((line) => line.debit > 0);
  const creditLine = draft.lines.find((line) => line.credit > 0);
  if (draft.type === "journal") {
    return { ...blank, ...shared, type: "journal", lines: draft.lines.map((line) => ({ accountId: line.accountId, debit: line.debit ? String(line.debit) : "", credit: line.credit ? String(line.credit) : "", memo: line.memo })) };
  }
  if (draft.type === "income") {
    return { ...blank, ...shared, type: "income", amount: String(creditLine?.credit ?? draft.amount), categoryAccountId: creditLine?.accountId || blank.categoryAccountId, cashAccountId: debitLine?.accountId || defaultCash };
  }
  if (draft.type === "expense") {
    return { ...blank, ...shared, type: "expense", amount: String(debitLine?.debit ?? draft.amount), categoryAccountId: debitLine?.accountId || blank.categoryAccountId, cashAccountId: creditLine?.accountId || defaultCash };
  }
  return { ...blank, ...shared, type: "transfer", amount: String(debitLine?.debit ?? draft.amount), toAccountId: debitLine?.accountId || defaultOtherAsset, fromAccountId: creditLine?.accountId || defaultCash };
}

function TransactionForm({ data, transactionId, onClose, onAction, working }: { data: Snapshot; transactionId?: string; onClose: () => void; onAction: Action; working: boolean }) {
  const assets = data.accounts.filter((item) => item.category === "asset" && item.isActive);
  const defaultCash = assets.find((item) => item.code === "1010")?.id || assets[0]?.id || "";
  const defaultOtherAsset = assets.find((item) => item.code !== "1010")?.id || assets[1]?.id || "";
  // Only drafts are editable; a posted entry must be reversed instead.
  const editing = data.transactions.find((txn) => txn.id === transactionId && txn.status === "draft");
  const initial = initialEntry(editing, data, defaultCash, defaultOtherAsset);
  const [type, setType] = useState<EntryType>(initial.type);
  const [date, setDate] = useState(initial.date);
  const [description, setDescription] = useState(initial.description);
  const [payee, setPayee] = useState(initial.payee);
  const [amount, setAmount] = useState(initial.amount);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod);
  const [categoryAccountId, setCategoryAccountId] = useState(initial.categoryAccountId);
  const [cashAccountId, setCashAccountId] = useState(initial.cashAccountId);
  const [fromAccountId, setFromAccountId] = useState(initial.fromAccountId);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId);
  const [lines, setLines] = useState<JournalDraft[]>(initial.lines);
  const categories = data.accounts.filter((item) => item.category === (type === "income" ? "income" : "expense") && item.isActive);
  const debitTotal = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const creditTotal = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  function changeType(next: EntryType) { setType(next); setCategoryAccountId(data.accounts.find((item) => item.category === (next === "income" ? "income" : "expense"))?.id || ""); }
  function updateLine(index: number, key: keyof JournalDraft, value: string) { setLines((existing) => existing.map((line, position) => position === index ? { ...line, [key]: value } : line)); }
  async function submit(saveAsDraft: boolean) {
    const payload = { type, date, description, payee, paymentMethod, amount, categoryAccountId, cashAccountId, fromAccountId, toAccountId, lines };
    const success = editing
      ? await onAction({ action: "updateTransaction", id: editing.id, ...payload })
      : await onAction({ action: "createTransaction", ...payload, saveAsDraft });
    if (success) onClose();
  }
  return <Modal title={editing ? "Edit draft entry" : "New transaction"} subtitle={editing ? `Correcting ${editing.reference}. It stays a draft until it is approved and posted.` : "Record a balanced entry in UPEC’s financial ledger."} onClose={onClose} wide><form onSubmit={(event) => { event.preventDefault(); submit(!editing); }}><div className="modal-body"><div className="transaction-type-tabs"><button type="button" className={type === "income" ? "active" : ""} onClick={() => changeType("income")}><ArrowDownLeft size={18} /> Income</button><button type="button" className={type === "expense" ? "active" : ""} onClick={() => changeType("expense")}><ArrowUpRight size={18} /> Expense</button><button type="button" className={type === "transfer" ? "active" : ""} onClick={() => changeType("transfer")}><ArrowLeftRight size={18} /> Transfer</button><button type="button" className={type === "journal" ? "active" : ""} onClick={() => changeType("journal")}><BookOpen size={18} /> Journal</button></div>
      <div className="form-grid"><label className="field field-wide">Description <span>*</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder={type === "expense" ? "e.g. Facilitator honoraria for May workshop" : "What is this transaction for?"} required /></label><label className="field">Transaction date <span>*</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field">Payee / source<input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder="Name or organisation" maxLength={200} /></label>
      {type !== "journal" && <label className="field">Amount (NGN) <span>*</span><div className="currency-input"><span>₦</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div></label>}
      {(type === "income" || type === "expense") && <><label className="field">{type === "income" ? "Income account" : "Expense account"} <span>*</span><select value={categoryAccountId} onChange={(event) => setCategoryAccountId(event.target.value)} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field">{type === "income" ? "Deposit into" : "Paid from"} <span>*</span><select value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)} required>{assets.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></>}
      {type === "transfer" && <><label className="field">Transfer from <span>*</span><select value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)} required>{assets.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field">Transfer to <span>*</span><select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)} required>{assets.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></>}
      <label className="field">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Bank transfer</option><option>Cash</option><option>POS / Card</option><option>Cheque</option><option>Internal transfer</option><option>Other</option></select></label></div>
      {type === "journal" && <div className="journal-editor"><div className="journal-editor-heading"><div><strong>Journal lines</strong><p>Debits must equal credits before posting.</p></div><button type="button" onClick={() => setLines([...lines, { accountId: data.accounts[0]?.id || "", debit: "", credit: "", memo: "" }])}><Plus size={15} /> Add line</button></div><div className="journal-editor-head"><span>ACCOUNT</span><span>DEBIT (₦)</span><span>CREDIT (₦)</span><span /></div>{lines.map((line, index) => <div className="journal-editor-line" key={index}><select aria-label={`Account for line ${index + 1}`} value={line.accountId} onChange={(event) => updateLine(index, "accountId", event.target.value)}>{data.accounts.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><input aria-label={`Debit for line ${index + 1}`} type="number" min="0" step="0.01" placeholder="0.00" value={line.debit} onChange={(event) => updateLine(index, "debit", event.target.value)} /><input aria-label={`Credit for line ${index + 1}`} type="number" min="0" step="0.01" placeholder="0.00" value={line.credit} onChange={(event) => updateLine(index, "credit", event.target.value)} /><button type="button" aria-label={`Remove line ${index + 1}`} disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, position) => position !== index))}><Trash2 size={17} /></button></div>)}<div className={`journal-editor-total ${Math.abs(debitTotal - creditTotal) > 0.001 ? "unbalanced" : ""}`}><span>{Math.abs(debitTotal - creditTotal) < 0.001 && debitTotal > 0 ? "Balanced entry" : "Difference must be ₦0.00"}</span><strong>{formatMoney(debitTotal, 2)}</strong><strong>{formatMoney(creditTotal, 2)}</strong><span /></div></div>}
      <div className="form-info"><CircleAlert size={17} /><span>{editing
        ? <>Saving keeps this entry a <strong>draft</strong>. Approve and post it from the transaction panel when it is correct.</>
        : <>Posting writes an immutable double-entry record. Use <strong>Save as draft</strong> if this entry needs review first.</>}</span></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>{editing
        ? <button type="submit" className="btn btn-primary" disabled={working}>{working ? "Saving..." : "Save changes"}</button>
        : <div><button type="button" className="btn btn-secondary" disabled={working} onClick={() => submit(true)}>Save as draft</button><button type="submit" className="btn btn-primary" disabled={working}>{working ? "Saving..." : "Post transaction"}</button></div>}</div></form></Modal>;
}

function AccountForm({ data, accountId, onClose, onAction, working }: { data: Snapshot; accountId?: string; onClose: () => void; onAction: Action; working: boolean }) {
  const editing = data.accounts.find((item) => item.id === accountId);
  const [code, setCode] = useState(editing?.code || "");
  const [name, setName] = useState(editing?.name || "");
  const [category, setCategory] = useState(editing?.category || "expense");
  const [description, setDescription] = useState(editing?.description || "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  // Reports classify income and expenditure by category, so it is locked once lines exist.
  const categoryLocked = !!editing?.hasEntries;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = editing
      ? await onAction({ action: "updateAccount", id: editing.id, code, name, category, description, isActive })
      : await onAction({ action: "createAccount", code, name, category, description });
    if (saved) onClose();
  }
  return <Modal title={editing ? "Edit account" : "Add account"} subtitle={editing ? `Correcting ${editing.code} · ${editing.name}.` : "Extend the institutional chart of accounts."} onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid"><label className="field">Account code <span>*</span><input inputMode="numeric" pattern="[0-9]{3,12}" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. 5070" required /></label><label className="field">Category <span>*</span><select value={category} onChange={(event) => setCategory(event.target.value as AccountCategory)} disabled={categoryLocked}><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expense</option></select></label><label className="field field-wide">Account name <span>*</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Research and development" maxLength={160} required /></label><label className="field field-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this account used for?" rows={3} maxLength={500} /></label>{editing && <label className="field field-wide account-status-field"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Keep this account active for new entries</label>}</div><div className="form-info"><CircleAlert size={17} /><span>{categoryLocked
        ? "This account already has ledger entries, so its category is locked to protect past statements. Create a new account if you need the other category."
        : "Account codes are unique. New expense accounts can be given an allocation in Budget monitoring."}</span></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={working} type="submit">{working ? "Saving..." : editing ? "Save account" : "Add account"}</button></div></form></Modal>;
}

function BudgetForm({ data, accountId, onClose, onAction, working }: { data: Snapshot; accountId?: string; onClose: () => void; onAction: Action; working: boolean }) {
  const [selectedId, setSelectedId] = useState(accountId || data.budgets[0]?.accountId || "");
  const selected = data.budgets.find((item) => item.accountId === selectedId);
  const [allocated, setAllocated] = useState(String(selected?.allocated || 0));
  async function submit(event: FormEvent) { event.preventDefault(); if (await onAction({ action: "saveBudget", accountId: selectedId, allocated })) onClose(); }
  return <Modal title="Manage allocation" subtitle={`Update the approved budget for FY ${data.fiscalYear}.`} onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid"><label className="field field-wide">Expense account <span>*</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setAllocated(String(data.budgets.find((item) => item.accountId === event.target.value)?.allocated || 0)); }}>{data.budgets.map((item) => <option key={item.accountId} value={item.accountId}>{item.accountCode} · {item.accountName}</option>)}</select></label><label className="field field-wide">Approved allocation (NGN) <span>*</span><div className="currency-input"><span>₦</span><input type="number" min="0" step="0.01" value={allocated} onChange={(event) => setAllocated(event.target.value)} required /></div></label></div><div className="allocation-context"><span>Actual spending to date</span><strong>{formatMoney(selected?.spent || 0, 2)}</strong><small>Changing the allocation does not alter posted expenditure.</small></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={working} type="submit">{working ? "Saving..." : "Save allocation"}</button></div></form></Modal>;
}

function UserForm({ onClose, onAction, working, canCreateAdmins }: { onClose: () => void; onAction: Action; working: boolean; canCreateAdmins: boolean }) {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<Role>("finance_officer"); const [password, setPassword] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (await onAction({ action: "createUser", fullName, email, role, password })) onClose(); }
  const choices = assignableRoles.filter((option) => option !== "admin" || canCreateAdmins);
  return <Modal title="Add team member" subtitle="Create a secure account with the right level of access." onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid"><label className="field field-wide">Full name <span>*</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Chinedu Okafor" required maxLength={160} /></label><label className="field field-wide">Work email <span>*</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@upec.edu.ng" required maxLength={255} /></label><label className="field field-wide">Access role <span>*</span><select value={role} onChange={(event) => setRole(event.target.value as Role)}>{choices.map((option) => <option key={option} value={option}>{roleLabel[option]} — {roleSummary[option]}</option>)}</select></label><label className="field field-wide">Temporary password <span>*</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a strong password" minLength={10} required /></label></div><div className="form-info"><CircleAlert size={17} /><span>Use 10+ characters with uppercase, lowercase, a number and a symbol. Share credentials through a secure channel; ask the user to change their password at first sign-in.</span></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={working} type="submit">{working ? "Adding..." : "Add member"}</button></div></form></Modal>;
}

export default function ActionModal({ kind, data, budgetAccountId, accountId, transactionId, onClose, onAction, working }: {
  kind: ModalKind;
  data: Snapshot;
  budgetAccountId?: string;
  accountId?: string;
  transactionId?: string;
  onClose: () => void;
  onAction: Action;
  working: boolean;
}) {
  if (kind === "transaction") return <TransactionForm data={data} transactionId={transactionId} onClose={onClose} onAction={onAction} working={working} />;
  if (kind === "account") return <AccountForm data={data} accountId={accountId} onClose={onClose} onAction={onAction} working={working} />;
  if (kind === "budget") return <BudgetForm data={data} accountId={budgetAccountId} onClose={onClose} onAction={onAction} working={working} />;
  return <UserForm canCreateAdmins={isOwner(data.user.role)} onClose={onClose} onAction={onAction} working={working} />;
}

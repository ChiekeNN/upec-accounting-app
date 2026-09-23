"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginScreen({ demoEnabled, demoEmail }: { demoEnabled: boolean; demoEmail: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event?: FormEvent, demo = false) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: demo ? demoEmail : email, password: demo ? "UpecDemo@2026!" : password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-left">
        <div className="login-brand">
          <img src="/icons/upec-mark.svg" alt="UPEC emblem" className="login-logo" />
          <div><span className="login-brand-title">UPEC</span><span className="login-brand-subtitle">ACCOUNTING SOFTWARE</span></div>
        </div>
        <div className="login-content">
          <div className="login-eyebrow"><span className="login-eyebrow-dot" /> INSTITUTIONAL FINANCE PORTAL</div>
          <h1>Welcome back<span className="login-heading-dot">.</span></h1>
          <p className="login-intro">Sign in to your UPEC workspace to manage finances with clarity and confidence.</p>
          <form onSubmit={(event) => signIn(event)} className="login-form">
            <label htmlFor="login-email">Work email address</label>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@upec.edu.ng" required />
            <div className="login-password-label"><label htmlFor="login-password">Password</label><LockKeyhole size={14} strokeWidth={1.8} /></div>
            <div className="password-wrap">
              <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in to workspace"}<ArrowRight size={18} /></button>
          </form>
          {demoEnabled && <div className="demo-access">
            <div className="demo-access-icon"><Sparkles size={18} /></div>
            <div><strong>Exploring the demo?</strong><span>Preview the full accounting workspace with sample records.</span><button type="button" onClick={() => signIn(undefined, true)} disabled={loading}>Open demo workspace <ArrowRight size={14} /></button></div>
          </div>}
          <div className="login-security"><ShieldCheck size={17} /><span>Protected access · Encrypted credentials · Activity monitored</span></div>
        </div>
        <footer className="login-footer"><span>© {new Date().getFullYear()} University of Port Harcourt Entrepreneurial Centre</span><span>Vote Head 520</span></footer>
      </section>
      <aside className="login-right">
        <div className="login-photo" />
        <div className="login-photo-shade" />
        <div className="login-right-top"><span className="login-university-mark">UNIPORT</span><span>University of Port Harcourt<br />Entrepreneurial Centre</span></div>
        <div className="login-right-bottom"><span className="login-image-kicker">PURPOSE-BUILT FOR UPEC</span><h2>Better financial visibility.<br />Stronger institutional impact.</h2><p>One connected place for budgets, transactions, reporting and accountability.</p><div className="login-image-rule"><span /><span /><span /></div></div>
      </aside>
    </div>
  );
}

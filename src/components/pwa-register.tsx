"use client";

import { useEffect } from "react";

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export type InstallWindow = Window & { upecInstallPrompt?: InstallPromptEvent };

export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, { once: true });
      if (document.readyState === "complete") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      (window as InstallWindow).upecInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event("upec:installable"));
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);
  return null;
}

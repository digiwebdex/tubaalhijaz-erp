// ─── Global Language Context ──────────────────────────────────────────────────
// Bengali (বাংলা) is the DEFAULT. English is the alternative.
// One toggle anywhere in the app switches the entire UI simultaneously.
//
// Usage (any component):
//   import { useLang } from "../lib/LangContext";
//   const { lang, toggleLang } = useLang();

import { createContext, useContext, useState, type ReactNode } from "react";
import { type Lang } from "./i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "bn",
  setLang: () => {},
  toggleLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("bn");
  const toggleLang = () => setLang(l => l === "bn" ? "en" : "bn");
  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

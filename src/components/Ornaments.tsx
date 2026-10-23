import type { ReactNode } from "react";
import { COUPLE } from "../config";
import { useLang } from "../i18n";

export function Lotus() {
  return (
    <svg className="lotus" viewBox="-50 -30 100 58" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 24C-14 14-14-4 0-22 14-4 14 14 0 24Z" />
        <path d="M0 24C-26 22-34 4-30-10-16-6-6 6 0 24Z" />
        <path d="M0 24C26 22 34 4 30-10 16-6 6 6 0 24Z" />
        <path d="M0 24C-38 26-48 14-46 4-30 4-12 12 0 24Z" />
        <path d="M0 24C38 26 48 14 46 4 30 4 12 12 0 24Z" />
      </g>
    </svg>
  );
}

/** Toran strip + gold double-line frame with diamond corners */
export function Frame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <div className="toran" />
      <main className={`frame${wide ? " wide" : ""}`}>
        <span className="dia tl" /><span className="dia tr" /><span className="dia bl" /><span className="dia br" />
        {children}
      </main>
    </>
  );
}

export function LangButton() {
  const { t, toggle } = useLang();
  return <button className="lang" type="button" onClick={toggle}>{t("langBtn")}</button>;
}

export function CoupleNames() {
  const { lang } = useLang();
  return (
    <h1 className="names">
      {lang === "ta" ? `${COUPLE.groomTa} & ${COUPLE.brideTa}` : `${COUPLE.groom} & ${COUPLE.bride}`}
    </h1>
  );
}

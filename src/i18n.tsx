import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const en = {
  title: "Our Wedding Wishes", sub: "Leave a blessing and sign our wedding book",
  name: "Your name", rel: "Relationship to the couple (optional)", relPh: "Friend, cousin, neighbour…",
  msg: "Your message", msgPh: "Write your wishes for the couple…",
  sig: "Your signature", signHint: "Draw with your finger or mouse", clear: "Clear",
  submit: "Send my wishes", sending: "Sending…",
  thanks: "Thank you!", thanksSub: "Your wishes are now in the wedding book.", another: "Write another",
  errName: "Please enter your name.", errMsg: "Please write a message.", errSig: "Please draw your signature.",
  errSend: "Could not send. Check your connection and try again.",
  errCfg: "Site is not set up yet. Add the Supabase keys in the .env file.",
  langBtn: "தமிழ்",
};
export type Key = keyof typeof en;

const ta: Record<Key, string> = {
  title: "எங்கள் திருமண வாழ்த்துகள்", sub: "ஆசீர்வாதம் எழுதி, திருமண புத்தகத்தில் கையொப்பமிடுங்கள்",
  name: "உங்கள் பெயர்", rel: "மணமக்களுடன் உறவு (விருப்பம்)", relPh: "நண்பர், உறவினர், அண்டை வீட்டார்…",
  msg: "உங்கள் வாழ்த்துச் செய்தி", msgPh: "மணமக்களுக்கு உங்கள் வாழ்த்துகளை எழுதுங்கள்…",
  sig: "உங்கள் கையொப்பம்", signHint: "விரலால் அல்லது மவுஸால் வரையவும்", clear: "அழி",
  submit: "வாழ்த்தை அனுப்பு", sending: "அனுப்புகிறது…",
  thanks: "நன்றி!", thanksSub: "உங்கள் வாழ்த்து திருமண புத்தகத்தில் சேர்க்கப்பட்டது.", another: "மற்றொன்று எழுது",
  errName: "உங்கள் பெயரை உள்ளிடவும்.", errMsg: "வாழ்த்துச் செய்தியை எழுதவும்.", errSig: "உங்கள் கையொப்பத்தை வரையவும்.",
  errSend: "அனுப்ப முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.",
  errCfg: "தளம் இன்னும் அமைக்கப்படவில்லை. .env கோப்பில் Supabase விசைகளைச் சேர்க்கவும்.",
  langBtn: "English",
};

export type Lang = "en" | "ta";
const dict: Record<Lang, Record<Key, string>> = { en, ta };

interface Ctx { lang: Lang; t: (k: Key) => string; toggle: () => void }
const LangContext = createContext<Ctx | null>(null);

function initial(): Lang {
  try { return localStorage.getItem("lang") === "ta" ? "ta" : "en"; } catch { return "en"; }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = dict[lang].title;
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
  }, [lang]);
  const t = useCallback((k: Key) => dict[lang][k], [lang]);
  const toggle = useCallback(() => setLang(l => (l === "en" ? "ta" : "en")), []);
  const value = useMemo(() => ({ lang, t, toggle }), [lang, t, toggle]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const c = useContext(LangContext);
  if (!c) throw new Error("useLang must be used inside LangProvider");
  return c;
}

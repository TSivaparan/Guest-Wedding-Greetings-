import { useRef, useState, type FormEvent } from "react";
import { COUPLE } from "../config";
import { useLang, type Key } from "../i18n";
import { sb } from "../supabase";
import { CoupleNames, Frame, LangButton, Lotus } from "../components/Ornaments";
import SignaturePad, { type PadHandle } from "../components/SignaturePad";

export default function GuestPage() {
  const { lang, t } = useLang();
  const pad = useRef<PadHandle>(null);
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [msg, setMsg] = useState("");
  const [trap, setTrap] = useState("");
  const [err, setErr] = useState<Key | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (trap) return; // bot trap
    if (!name.trim()) return setErr("errName");
    if (!msg.trim()) return setErr("errMsg");
    if (pad.current?.isEmpty()) return setErr("errSig");
    if (!sb) return setErr("errCfg");

    setSending(true);
    const { error } = await sb.from("wishes").insert({
      guest_name: name.trim(),
      relationship: rel.trim() || null,
      message: msg.trim(),
      signature: pad.current!.toPNG(),
      lang,
    });
    setSending(false);
    if (error) { console.error(error); return setErr("errSend"); }
    setDone(true);
  }

  function again() {
    setName(""); setRel(""); setMsg(""); setErr(null); setDone(false);
  }

  return (
    <Frame>
      <LangButton />
      <Lotus />
      <CoupleNames />
      <p className="date">{COUPLE.date}</p>
      <p className="site">{t("title")}</p>
      <p className="lede">{t("sub")}</p>
      <div className="rule" />

      {done ? (
        <section className="thanks">
          <Lotus />
          <h2>{t("thanks")}</h2>
          <p>{t("thanksSub")}</p>
          <button className="btn" type="button" onClick={again}>{t("another")}</button>
        </section>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="name">{t("name")}</label>
          <input id="name" maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />

          <label htmlFor="rel">{t("rel")}</label>
          <input id="rel" maxLength={80} placeholder={t("relPh")} value={rel} onChange={e => setRel(e.target.value)} />

          <label htmlFor="msg">{t("msg")}</label>
          <textarea id="msg" maxLength={1000} placeholder={t("msgPh")} value={msg} onChange={e => setMsg(e.target.value)} />

          <label htmlFor="pad">{t("sig")}</label>
          <SignaturePad ref={pad} hint={t("signHint")} label={t("sig")} />
          <button className="link" type="button" onClick={() => pad.current?.clear()}>{t("clear")}</button>

          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={e => setTrap(e.target.value)} />
          <p className="err" role="alert">{err ? t(err) : ""}</p>
          <button className="btn" type="submit" disabled={sending}>{sending ? t("sending") : t("submit")}</button>
        </form>
      )}
    </Frame>
  );
}

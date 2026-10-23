import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { COUPLE } from "../config";
import { sb } from "../supabase";
import type { Wish } from "../types";
import { Frame, Lotus } from "../components/Ornaments";
import WishCard from "../components/WishCard";

type Tab = "cards" | "board";
interface PrintJob { list: Wish[]; cols: boolean }

function save(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await sb!.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr("Wrong email or password."); else onDone();
  }
  return (
    <Frame>
      <Lotus />
      <h1 className="names" style={{ fontSize: "1.8rem" }}>Admin sign in</h1>
      <form onSubmit={submit} noValidate>
        <label htmlFor="em">Email</label>
        <input id="em" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
        <p className="err" role="alert">{err}</p>
        <button className="btn" type="submit">Sign in</button>
      </form>
    </Frame>
  );
}

function Dashboard({ onOut }: { onOut: () => void }) {
  const [rows, setRows] = useState<Wish[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("cards");
  const [job, setJob] = useState<PrintJob | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb!.from("wishes").select("*").order("created_at", { ascending: false });
    if (error) alert("Could not load: " + error.message); else setRows(data as Wish[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? rows : rows.filter(w => `${w.guest_name} ${w.relationship ?? ""} ${w.message}`.toLowerCase().includes(s));
  }, [rows, q]);

  // printing: render cards into #printArea, then call window.print()
  useEffect(() => {
    if (!job) return;
    document.body.classList.add("printing");
    document.body.classList.toggle("cols", job.cols);
    const done = () => { document.body.classList.remove("printing", "cols"); setJob(null); };
    window.addEventListener("afterprint", done, { once: true });
    const timer = setTimeout(() => window.print(), 100);
    return () => { clearTimeout(timer); window.removeEventListener("afterprint", done); };
  }, [job]);

  async function remove(w: Wish) {
    if (!confirm(`Delete the wish from ${w.guest_name}? Export a backup first.`)) return;
    const { error } = await sb!.from("wishes").delete().eq("id", w.id);
    if (error) alert(error.message); else void load();
  }

  function exportCsv() {
    const quote = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map(w => [w.created_at, w.guest_name, w.relationship, w.message, w.lang].map(quote).join(","));
    // BOM keeps Tamil readable when opened in Excel
    save(`wedding-wishes-${stamp()}.csv`, "\ufeff" + ["created_at,guest_name,relationship,message,lang", ...lines].join("\n"), "text/csv");
  }

  return (
    <>
      <Frame wide>
        <h1 className="names" style={{ fontSize: "1.9rem" }}>{COUPLE.groom} &amp; {COUPLE.bride}</h1>
        <p className="date"><span className="count">{list.length} of {rows.length} wishes</span></p>
        <div className="rule" />

        <div className="bar">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")}>Signature cards</button>
            <button role="tab" aria-selected={tab === "board"} onClick={() => setTab("board")}>Wedding board</button>
          </div>
          <input className="search" placeholder="Search name or message" value={q} onChange={e => setQ(e.target.value)} />
          <span className="grow" />
          <button className="btn small" onClick={() => setJob({ list, cols: false })}>Print all cards</button>
          <button className="btn small ghost" onClick={() => setJob({ list, cols: true })}>Print board</button>
          <button className="btn small ghost" onClick={() => save(`wedding-wishes-backup-${stamp()}.json`, JSON.stringify(rows, null, 2), "application/json")}>Backup (JSON)</button>
          <button className="btn small ghost" onClick={exportCsv}>Export CSV</button>
          <button className="btn small ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn small ghost" onClick={onOut}>Sign out</button>
        </div>

        {tab === "cards" ? (
          <div className="grid">
            {list.map(w => (
              <div className="cell" key={w.id}>
                <WishCard wish={w} />
                <div className="acts">
                  <button className="btn small" onClick={() => setJob({ list: [w], cols: false })}>Print</button>
                  <a className="btn small ghost" download={`signature-${w.guest_name}.png`} href={w.signature}>Signature PNG</a>
                  <button className="btn small ghost" onClick={() => void remove(w)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="board">{list.map(w => <WishCard key={w.id} wish={w} />)}</div>
        )}
      </Frame>

      <div id="printArea">{job?.list.map(w => <WishCard key={w.id} wish={w} />)}</div>
    </>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  if (!sb) return <Frame><p className="err">Add your Supabase keys to the .env file first.</p></Frame>;
  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Dashboard onOut={async () => { await sb!.auth.signOut(); setAuthed(false); }} />;
}

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { toCanvas } from "html-to-image";
import { COUPLE } from "../config";
import type { Wish } from "../types";

interface Paper { id: string; label: string; w: number; h: number } // millimetres, portrait
const PAPERS: Paper[] = [
  { id: "A4", label: "A4 (21 × 29.7 cm)", w: 210, h: 297 },
  { id: "A3", label: "A3 (29.7 × 42 cm)", w: 297, h: 420 },
  { id: "A2", label: "A2 (42 × 59.4 cm)", w: 420, h: 594 },
  { id: "A1", label: "A1 (59.4 × 84.1 cm)", w: 594, h: 841 },
  { id: "12x18", label: "12 × 18 in", w: 304.8, h: 457.2 },
  { id: "18x24", label: "18 × 24 in", w: 457.2, h: 609.6 },
  { id: "24x36", label: "24 × 36 in", w: 609.6, h: 914.4 },
];

type Region = "top" | "right" | "bottom" | "left";
const REGIONS: Region[] = ["top", "right", "bottom", "left"];
type Layout = Record<string, { x: number; y: number }>; // top-left corner, % of the sheet

const GRID = {
  portrait: { cols: [26, 48, 26], rows: [29, 42, 29] },
  landscape: { cols: [24, 52, 24], rows: [24, 52, 24] },
};
function areas(landscape: boolean): Record<Region, number> {
  const g = landscape ? GRID.landscape : GRID.portrait;
  return { top: 100 * g.rows[0], bottom: 100 * g.rows[2], left: g.cols[0] * g.rows[1], right: g.cols[2] * g.rows[1] };
}

const MM = 96 / 25.4;
const PHOTO_KEY = "wedding-board-photo";
const SETTINGS_KEY = "wedding-board-settings-v2";
const isTamil = (t: string) => /[\u0B80-\u0BFF]/.test(t);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Share wishes between the four regions so each fills up evenly (long messages count for more). */
function distribute(list: Wish[], landscape: boolean): Record<Region, Wish[]> {
  const AREA = areas(landscape);
  const out: Record<Region, Wish[]> = { top: [], right: [], bottom: [], left: [] };
  const load: Record<Region, number> = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const w of list) {
    const est = 70 + w.message.length;
    let best: Region = "top", bestV = Infinity;
    for (const r of REGIONS) {
      const v = (load[r] + est) / AREA[r];
      if (v < bestV) { bestV = v; best = r; }
    }
    out[best].push(w); load[best] += est;
  }
  return out;
}

function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600, f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read the image")); };
    img.src = url;
  });
}

const DEFAULT_BG = "#fff6e3";        // sheet background
const DEFAULT_SIG = "#3a0a14";       // signature ink
const DEFAULT_TEXT = "#4a0f1c";      // wish message text

interface Saved {
  layout: Layout | null; manualS: number; fitWhole: boolean;
  photoW: number; photoH: number; lockPhoto: boolean;          // photo size, % of its frame
  bg: string; sigColor: string; textColor: string | null;      // colours (textColor null = original colours)
}
const SAVED_DEFAULTS: Saved = {
  layout: null, manualS: 0.8, fitWhole: false,
  photoW: 100, photoH: 100, lockPhoto: true,
  bg: DEFAULT_BG, sigColor: DEFAULT_SIG, textColor: null,
};
function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved> & { photoScale?: number };
      const legacy = typeof p.photoScale === "number" ? { photoW: p.photoScale, photoH: p.photoScale } : {}; // older saves had one size
      return { ...SAVED_DEFAULTS, ...legacy, ...p };
    }
  } catch { /* ignore */ }
  return SAVED_DEFAULTS;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Signatures are stored as dark ink on an ivory background. This turns the ivory into transparent
 * and paints the ink in the chosen colour, so it works on any board background.
 */
function tintSignature(src: string, color: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        const [r, g, b] = hexToRgb(color);
        for (let i = 0; i < px.length; i += 4) {
          // red channel: 255 on the paper, 58 on full ink -> how much ink is in this pixel
          let a = (255 - px[i]) / (255 - 58);
          a = a < 0.03 ? 0 : Math.min(1, a);
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(a * px[i + 3]);
        }
        ctx.putImageData(data, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

const SIZE_PRESETS = [
  { id: "print", label: "Print quality (300 DPI at paper size)" },
  { id: "6000", label: "6000 px wide" },
  { id: "4000", label: "4000 px wide" },
  { id: "3000", label: "3000 px wide" },
  { id: "2000", label: "2000 px wide" },
  { id: "1080", label: "1080 px wide (WhatsApp / Instagram)" },
  { id: "custom", label: "Custom size…" },
];
const MAX_SIDE = 12000; // browsers cannot make canvases much bigger than this

export default function FrameBoard({ wishes }: { wishes: Wish[] }) {
  const saved = useMemo(loadSaved, []);
  const [paperId, setPaperId] = useState("A3");
  const [landscape, setLandscape] = useState(false);
  const [photo, setPhoto] = useState<string | null>(() => {
    try { return localStorage.getItem(PHOTO_KEY); } catch { return null; }
  });
  const [layout, setLayout] = useState<Layout | null>(saved.layout);   // null = automatic arrangement
  const [manualS, setManualS] = useState(saved.manualS);
  const [photoW, setPhotoW] = useState(saved.photoW);
  const [photoH, setPhotoH] = useState(saved.photoH);
  const [lockPhoto, setLockPhoto] = useState(saved.lockPhoto);
  const [fitWhole, setFitWhole] = useState(saved.fitWhole);
  const [bg, setBg] = useState(saved.bg);
  const [sigColor, setSigColor] = useState(saved.sigColor);
  const [textColor, setTextColor] = useState<string | null>(saved.textColor);
  const [sigs, setSigs] = useState<Record<string, string>>({});   // recoloured signatures by wish id
  const [sizeId, setSizeId] = useState("print");
  const [customW, setCustomW] = useState(3000);
  const [fmt, setFmt] = useState<"png" | "jpeg">("png");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [fitS, setFitS] = useState(1);
  const [zoom, setZoom] = useState(0.5);
  const [dragId, setDragId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());

  const paper = PAPERS.find(p => p.id === paperId)!;
  const W = landscape ? paper.h : paper.w;
  const H = landscape ? paper.w : paper.h;
  const k = Math.min(W, H) / 210; // everything scales with the paper size

  const list = useMemo(
    () => [...wishes].filter(w => !off.has(w.id)).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [wishes, off]
  );
  const regions = useMemo(() => distribute(list, landscape), [list, landscape]);

  // latest values for the drag handlers
  const live = useRef({ layout, zoom, W, H, fitS });
  live.current = { layout, zoom, W, H, fitS };

  /** Automatic mode: biggest text size at which every region still fits. */
  const fit = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet || live.current.layout) return;
    const inners = Array.from(sheet.querySelectorAll<HTMLElement>(".fb-in"));
    const overflows = () => inners.some(el => {
      const r = el.parentElement!;
      return el.offsetHeight > r.clientHeight + 1 || el.scrollWidth > r.clientWidth + 1;
    });
    let lo = 0.2, hi = 1.6;
    sheet.style.setProperty("--s", String(hi));
    if (overflows()) {
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        sheet.style.setProperty("--s", String(mid));
        if (overflows()) hi = mid; else lo = mid;
      }
      sheet.style.setProperty("--s", String(lo));
      setFitS(lo);
    } else {
      setFitS(hi);
    }
  }, []);

  useLayoutEffect(() => {
    if (layout) sheetRef.current?.style.setProperty("--s", String(manualS));
    else fit();
  }, [fit, regions, W, H, layout === null, manualS]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void document.fonts.ready.then(fit); }, [fit, regions]);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout, manualS, fitWhole, photoW, photoH, lockPhoto, bg, sigColor, textColor })); } catch { /* ignore */ }
  }, [layout, manualS, fitWhole, photoW, photoH, lockPhoto, bg, sigColor, textColor]);

  // recolour the signatures (waits a moment while the colour picker is being dragged)
  const sigColorLive = useDeferredValue(sigColor);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: Record<string, string> = {};
      for (const w of wishes) out[w.id] = await tintSignature(w.signature, sigColorLive);
      if (!cancelled) setSigs(out);
    })();
    return () => { cancelled = true; };
  }, [wishes, sigColorLive]);

  // shrink the preview to the screen width
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setZoom(Math.min(1, host.clientWidth / (W * MM)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [W]);

  // print exactly one page
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("printing-board");
    let timer = 0;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    void document.fonts.ready.then(() => {
      fit();
      timer = window.setTimeout(() => window.print(), 300);
    });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-board");
    };
  }, [printing, fit]);

  // ---------- drag and drop ----------
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; started: boolean } | null>(null);

  /** Read where every greeting currently sits (automatic layout) so it can be moved by hand. */
  function capture(): Layout {
    const sheet = sheetRef.current!;
    const sr = sheet.getBoundingClientRect();
    const { zoom: z, W: w, H: h } = live.current;
    const out: Layout = {};
    sheet.querySelectorAll<HTMLElement>(".fb-card[data-id]").forEach(el => {
      const r = el.getBoundingClientRect();
      out[el.dataset.id!] = { x: ((r.left - sr.left) / z / (w * MM)) * 100, y: ((r.top - sr.top) / z / (h * MM)) * 100 };
    });
    return out;
  }

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.started) {
      if (Math.hypot(dx, dy) < 5) return;
      d.started = true;
      let cur = live.current.layout;
      if (!cur) {                       // first move: freeze the automatic layout, keep its text size
        cur = capture();
        live.current.layout = cur;
        setManualS(Math.round(live.current.fitS * 50) / 50);
        setLayout(cur);
      }
      const p = cur[d.id] ?? { x: 3, y: 13 };
      d.ox = p.x; d.oy = p.y;
      setDragId(d.id);
    }
    const { zoom: z, W: w, H: h } = live.current;
    let nx = d.ox + (dx / z / (w * MM)) * 100;
    let ny = d.oy + (dy / z / (h * MM)) * 100;
    const el = els.current.get(d.id);
    if (el) {
      nx = clamp(nx, 0, 100 - (el.offsetWidth / (w * MM)) * 100);
      ny = clamp(ny, 0, 100 - (el.offsetHeight / (h * MM)) * 100);
    }
    setLayout(prev => ({ ...(prev ?? {}), [d.id]: { x: nx, y: ny } }));
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragId(null);
    window.removeEventListener("pointermove", onMove);
  }, [onMove]);

  function onDown(e: RPointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: 0, oy: 0, started: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  }
  useEffect(() => () => window.removeEventListener("pointermove", onMove), [onMove]);

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = await shrinkImage(f);
      setPhoto(data);
      try { localStorage.setItem(PHOTO_KEY, data); } catch { /* photo stays for this session only */ }
    } catch (err) { alert((err as Error).message); }
  }
  function removePhoto() {
    setPhoto(null);
    try { localStorage.removeItem(PHOTO_KEY); } catch { /* ignore */ }
  }
  function changePhotoW(v: number) { setPhotoW(v); if (lockPhoto) setPhotoH(v); }
  function changePhotoH(v: number) { setPhotoH(v); if (lockPhoto) setPhotoW(v); }
  function toggleLock(on: boolean) { setLockPhoto(on); if (on) setPhotoH(photoW); }
  function resetColours() { setBg(DEFAULT_BG); setSigColor(DEFAULT_SIG); setTextColor(null); }

  // ---------- download as image ----------
  const aspect = (H - 0.5) / W;                      // sheet height / width
  const rawW = sizeId === "print" ? (W / 25.4) * 300 : sizeId === "custom" ? customW : Number(sizeId);
  let outW = Math.max(200, Math.round(rawW) || 200);
  if (Math.max(outW, outW * aspect) > MAX_SIDE) outW = Math.floor(MAX_SIDE / Math.max(1, aspect));
  const outH = Math.round(outW * aspect);
  const capped = Math.round(rawW) > outW;

  async function downloadImage() {
    const sheet = sheetRef.current;
    if (!sheet || exporting) return;
    setExporting(true); setExportMsg("Rendering image…");
    try {
      await document.fonts.ready;
      if (!live.current.layout) fit();
      const render = (skipFonts: boolean, pixelRatio: number) =>
        toCanvas(sheet, { pixelRatio, backgroundColor: bg, skipFonts, cacheBust: false });
      let skipFonts = false;
      try { await render(false, 0.2); } catch { skipFonts = true; }   // warm-up: loads fonts and photo once
      const ratio = outW / sheet.offsetWidth;
      const canvas = await render(skipFonts, ratio);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, fmt === "png" ? "image/png" : "image/jpeg", 0.95));
      if (!blob) throw new Error("This browser could not create an image this large. Choose a smaller size.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wedding-wishes-board-${canvas.width}x${canvas.height}.${fmt === "png" ? "png" : "jpg"}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);
      setExportMsg(`Downloaded ${canvas.width} × ${canvas.height} px${skipFonts ? " (fonts could not be embedded)" : ""}.`);
    } catch (err) {
      setExportMsg((err as Error).message || "Could not create the image.");
    } finally {
      setExporting(false);
    }
  }

  function toggle(id: string) {
    setOff(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const g = landscape ? GRID.landscape : GRID.portrait;
  const gridCols = g.cols.map(n => `minmax(0,${n}fr)`).join(" ");
  const gridRows = g.rows.map(n => `minmax(0,${n}fr)`).join(" ");
  const vars = {
    "--k": k, width: `${W}mm`, height: `${H - 0.5}mm`,
    background: bg, "--bg": bg,
    ...(textColor ? { color: textColor, "--tx-name": textColor } : {}),
  } as CSSProperties;

  const body = (w: Wish) => (
    <>
      <p className={"fb-msg" + (isTamil(w.message) ? " ta" : "")}>{w.message}</p>
      <img className="fb-sig" src={sigs[w.id] ?? w.signature} alt="" draggable={false} />
      <span className="fb-name">({w.guest_name})</span>
    </>
  );
  const renderRegion = (r: Region) => (
    <div className={`fb-reg ${r}`}>
      <div className="fb-in" onLoadCapture={fit}>
        {!layout && regions[r].map(w => (
          <div className="fb-card" data-id={w.id} key={w.id} onPointerDown={e => onDown(e, w.id)}>{body(w)}</div>
        ))}
      </div>
    </div>
  );

  let unplaced = 0;
  return (
    <div className="fb-root">
      {printing && <style>{`@page{size:${W}mm ${H}mm;margin:0}`}</style>}

      <div className="fb-controls">
        <select aria-label="Paper size" value={paperId} onChange={e => setPaperId(e.target.value)}>
          {PAPERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label className="chk"><input type="checkbox" checked={landscape} onChange={e => setLandscape(e.target.checked)} /> Landscape</label>
        <label className="btn small ghost">
          {photo ? "Change couple photo" : "Add couple photo"}
          <input type="file" accept="image/*" hidden onChange={e => void onPhoto(e)} />
        </label>
        {photo && <button className="btn small ghost" onClick={removePhoto}>Remove photo</button>}
        <span className="grow" />
        {layout && <button className="btn small ghost" onClick={() => setLayout(null)}>Auto-arrange again</button>}
        <button className="btn small" onClick={() => setPrinting(true)}>Print board (1 page)</button>

        <div className="fb-sliders">
          <label className="chk">{lockPhoto ? "Photo size" : "Photo width"}
            <input type="range" min={30} max={130} step={1} value={photoW} onChange={e => changePhotoW(Number(e.target.value))} />
            <b>{photoW}%</b>
          </label>
          {!lockPhoto && (
            <label className="chk">Photo height
              <input type="range" min={30} max={130} step={1} value={photoH} onChange={e => changePhotoH(Number(e.target.value))} />
              <b>{photoH}%</b>
            </label>
          )}
          <label className="chk"><input type="checkbox" checked={lockPhoto} onChange={e => toggleLock(e.target.checked)} /> Keep photo proportions</label>
          <label className="chk"><input type="checkbox" checked={fitWhole} onChange={e => setFitWhole(e.target.checked)} /> Show whole photo (no crop)</label>
          {layout && (
            <label className="chk">Text size
              <input type="range" min={0.3} max={1.8} step={0.02} value={manualS} onChange={e => setManualS(Number(e.target.value))} />
              <b>{Math.round(manualS * 100)}%</b>
            </label>
          )}
        </div>

        <div className="fb-sliders">
          <label className="chk">Background
            <input type="color" value={bg} onChange={e => setBg(e.target.value)} />
          </label>
          <label className="chk">Signature colour
            <input type="color" value={sigColor} onChange={e => setSigColor(e.target.value)} />
          </label>
          <label className="chk">Wish text colour
            <input type="color" value={textColor ?? DEFAULT_TEXT} onChange={e => setTextColor(e.target.value)} />
          </label>
          <button className="btn small ghost" onClick={resetColours}>Reset colours</button>
        </div>

        <div className="fb-sliders fb-export">
          <label className="chk">Image size
            <select aria-label="Image size" value={sizeId} onChange={e => setSizeId(e.target.value)}>
              {SIZE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          {sizeId === "custom" && (
            <>
              <label className="chk">Width
                <input type="number" min={200} max={MAX_SIDE} step={50} value={customW}
                  onChange={e => setCustomW(Number(e.target.value))} /> px
              </label>
              <label className="chk">Height
                <input type="number" min={200} max={MAX_SIDE} step={50} value={Math.round(customW * aspect)}
                  onChange={e => setCustomW(Math.round(Number(e.target.value) / aspect))} /> px
              </label>
            </>
          )}
          <label className="chk">Format
            <select aria-label="Image format" value={fmt} onChange={e => setFmt(e.target.value as "png" | "jpeg")}>
              <option value="png">PNG (best quality)</option>
              <option value="jpeg">JPG (smaller file)</option>
            </select>
          </label>
          <button className="btn small" disabled={exporting} onClick={() => void downloadImage()}>
            {exporting ? "Rendering…" : "Download image"}
          </button>
          <span className="fb-note">
            {outW} × {outH} px{capped ? ` (largest size this browser can make; ${Math.round(rawW)} px was requested)` : ""}.
            {" "}Width and height stay in proportion with the paper size.{exportMsg ? ` ${exportMsg}` : ""}
          </span>
        </div>

        <p className="fb-note">
          {list.length} of {wishes.length} wishes on the board.{" "}
          {layout
            ? "Drag any greeting to an empty place. Use the text size slider to make everything bigger or smaller."
            : <>Drag any greeting to move it (text size {Math.round(fitS * 100)}%).{fitS < 0.5 && <span className="fb-warn"> Many wishes: choose a bigger paper or untick some.</span>}</>}
          {" "}To print: margins None, scale 100%, then Save as PDF or your printer.
        </p>
        <details className="fb-pick">
          <summary>Choose which wishes to include</summary>
          <div>
            <button className="link" onClick={() => setOff(new Set())}>Select all</button>{" · "}
            <button className="link" onClick={() => setOff(new Set(wishes.map(w => w.id)))}>Select none</button>
          </div>
          {[...wishes].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(w => (
            <label key={w.id}>
              <input type="checkbox" checked={!off.has(w.id)} onChange={() => toggle(w.id)} />
              <span>{w.guest_name}: {w.message.length > 70 ? w.message.slice(0, 70) + "…" : w.message}</span>
            </label>
          ))}
        </details>
      </div>

      <div className="fb-host" ref={hostRef}>
        <div className="fb-wrap" style={{ width: W * MM * zoom, height: H * MM * zoom }}>
          <div className="fb-scale" style={{ transform: `scale(${zoom})` }}>
            <div className="fb-sheet" ref={sheetRef} style={vars}>
              <div className="fb-toran" />
              <div className="fb-edge" />
              <header className="fb-head">
                <h2 className="fb-names">{COUPLE.bride} <i>&amp;</i> {COUPLE.groom}</h2>
                <p className="fb-sub">Wedding wishes · {COUPLE.date}</p>
                <div className="fb-div" />
              </header>
              <div className="fb-grid" style={{ gridTemplateColumns: gridCols, gridTemplateRows: gridRows }}>
                {renderRegion("top")}
                {renderRegion("left")}
                <div className="fb-photo">
                  <div className="fb-pbox">
                    <div className="fb-pic" style={{ width: `${photoW}%`, height: `${photoH}%` }}>
                      {photo
                        ? <img src={photo} alt="The couple" draggable={false} style={{ objectFit: fitWhole ? "contain" : "cover" }} />
                        : <div className="fb-ph"><span>{COUPLE.bride} &amp; {COUPLE.groom}</span><small>Add the couple photo</small></div>}
                    </div>
                  </div>
                </div>
                {renderRegion("right")}
                {renderRegion("bottom")}
              </div>
              {layout && (
                <div className="fb-free">
                  {list.map(w => {
                    const p = layout[w.id] ?? { x: 3, y: 13 + 2.2 * unplaced++ };
                    return (
                      <div key={w.id} data-id={w.id} className={"fb-card free" + (dragId === w.id ? " drag" : "")}
                        ref={el => { if (el) els.current.set(w.id, el); else els.current.delete(w.id); }}
                        style={{ left: `${p.x}%`, top: `${p.y}%` }} onPointerDown={e => onDown(e, w.id)}>
                        {body(w)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

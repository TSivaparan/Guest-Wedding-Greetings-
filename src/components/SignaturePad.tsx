import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react";

export interface PadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toPNG: () => string;
}

interface Props { hint: string; label: string }

const SignaturePad = forwardRef<PadHandle, Props>(function SignaturePad({ hint, label }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const setup = useCallback(() => {
    const cv = canvas.current; if (!cv) return;
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    cv.width = r.width * d; cv.height = r.height * d;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#3a0a14"; ctx.fillStyle = "#3a0a14";
    dirtyRef.current = false; setDirty(false);
  }, []);

  useEffect(() => { setup(); }, [setup]);

  useImperativeHandle(ref, () => ({
    clear: setup,
    isEmpty: () => !dirtyRef.current,
    toPNG: () => {
      const cv = canvas.current!;
      // small PNG on an ivory background keeps each entry ~10-30 KB
      const out = document.createElement("canvas");
      out.width = 600; out.height = Math.round((600 * cv.height) / cv.width);
      const c = out.getContext("2d")!;
      c.fillStyle = "#fff6e3"; c.fillRect(0, 0, out.width, out.height);
      c.drawImage(cv, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  }), [setup]);

  const pt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d")!;
    drawing.current = true; last.current = pt(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 1.2, 0, 7); ctx.fill();
    dirtyRef.current = true; setDirty(true);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!, p = pt(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; };

  return (
    <div className={`padwrap${dirty ? " dirty" : ""}`}>
      <canvas id="pad" ref={canvas} aria-label={label}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="padhint">{hint}</div>
    </div>
  );
});

export default SignaturePad;

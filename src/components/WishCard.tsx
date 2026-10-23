import { COUPLE } from "../config";
import type { Wish } from "../types";

export default function WishCard({ wish }: { wish: Wish }) {
  return (
    <article className="wcard">
      <div className="wc-names">{COUPLE.bride} &amp; {COUPLE.groom}</div>
      <p className="wc-msg">{wish.message}</p>
      <img className="wc-sig" src={wish.signature} alt={`Signature of ${wish.guest_name}`} />
      <p className="wc-from">
        {wish.guest_name}
        {wish.relationship ? <span> · {wish.relationship}</span> : null}
      </p>
    </article>
  );
}

export interface Wish {
  id: string;
  created_at: string;
  guest_name: string;
  relationship: string | null;
  message: string;
  signature: string; // PNG data URL
  lang: string | null;
}

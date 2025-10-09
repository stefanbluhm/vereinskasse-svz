import { supabase } from "../supabase";

export async function addToTagesartikel({
  datum,        // "YYYY-MM-DD"
  produkt_id,   // uuid
  menge,        // number
  preis         // number | string
}: {
  datum: string;
  produkt_id: string;
  menge: number;
  preis: number | string;
}) {
  const anzahl = menge;
  const umsatz = Number(menge) * Number(preis);

  const { error } = await supabase
    .from("tagesartikel")
    .upsert(
      { datum, produkt_id, anzahl, umsatz },
      { onConflict: "datum,produkt_id" }  // <— MUSS exakt so passen
    );

  if (error) throw error;
}

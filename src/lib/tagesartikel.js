import { supabase } from "../supabase";

/**
 * Fügt Menge/Preis zum Tagesartikel hinzu (oder erhöht bestehende Zeile)
 */
export async function addToTagesartikel({ datum, produkt_id, menge, preis }) {
  const payload = {
    datum,
    produkt_id,
    anzahl: menge,
    umsatz: menge * preis,
  };

  const { error } = await supabase
    .from("tagesartikel")
    .upsert(payload, { onConflict: "datum,produkt_id" }) // braucht den Unique-Index!
    .select();

  if (error) throw error;
}

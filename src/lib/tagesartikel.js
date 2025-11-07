// src/lib/tagesartikel.js
import { supabase } from "../supabase";

/**
 * Addiert auf tagesartikel (oder legt an) anhand (datum, produkt_id).
 * anzahl = verkaufte Stückzahl
 * umsatz = anzahl * einzelpreis (als Zahl!)
 */
export async function addToTagesartikel({ datum, produkt_id, anzahl, umsatz }) {
  // harte Konvertierung, damit niemals NULL ankommt
  const a = Number(anzahl) || 0;
  const u = Number(umsatz) || 0;

  const { error } = await supabase
    .from("tagesartikel")
    .upsert(
      [{ datum, produkt_id, anzahl: a, umsatz: u }],
      { onConflict: "datum,produkt_id" } // wichtig für das Hochzählen per App-Logik
    );

  if (error) throw error;
}


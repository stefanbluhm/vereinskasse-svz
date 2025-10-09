// src/lib/tagesartikel.js
import { supabase } from "../supabase";

/**
 * Fügt verkaufte Menge/Preis zu den Tagesartikeln hinzu (Upsert).
 * Erwartet reines JS – keine Typannotationen!
 *
 * @param {Object} p
 * @param {string} p.datum       - ISO Datum (YYYY-MM-DD)
 * @param {string} p.produkt_id  - UUID des Produkts
 * @param {number} p.menge       - Anzahl
 * @param {number} p.preis       - Einzelpreis
 */
export async function addToTagesartikel({ datum, produkt_id, menge, preis }) {
  const anzahl = Number(menge) || 0;
  const umsatz = Number(preis) * anzahl;

  // Wenn du die RPC-Funktion `add_to_tagesartikel` in Supabase angelegt hast:
  try {
    const { error } = await supabase.rpc("add_to_tagesartikel", {
      p_datum: datum,
      p_produkt_id: produkt_id,
      p_anzahl: anzahl,
      p_umsatz: umsatz,
    });
    if (error) throw error;
    return;
  } catch (e) {
    // Fallback auf Upsert, falls RPC nicht existiert
  }

  // Fallback: direkter Upsert
  const { error } = await supabase
    .from("tagesartikel")
    .upsert(
      [
        {
          datum,
          produkt_id,
          anzahl,
          umsatz,
        },
      ],
      { onConflict: "datum,produkt_id" }
    );

  if (error) throw error;
}

import { supabase } from "../supabase";

/**
 * Summiert eine Artikelmenge in der Tagesübersicht auf.
 * @param {{datum: string, produkt_id: string, menge: number, preis: number}} p
 */
export async function addToTagesartikel({ datum, produkt_id, menge, preis }) {
  const anzahl = menge;
  const umsatz = Number((menge * preis).toFixed(2));
  const { error } = await supabase.rpc("add_to_tagesartikel", {
    p_datum: datum,
    p_produkt_id: produkt_id,
    p_anzahl: anzahl,
    p_umsatz: umsatz,
  });
  if (error) throw error;
}

/**
 * Erhöht für (datum, produkt_id) die Anzahl + Umsatz.
 * Falls noch kein Datensatz existiert -> insert.
 */
export async function addToTagesartikel({ datum, produkt_id, menge, preis }) {
  // Erst prüfen ob vorhanden
  const { data: rows, error: selErr } = await supabase
    .from("tagesartikel")
    .select("*")
    .eq("datum", datum)
    .eq("produkt_id", produkt_id)
    .limit(1);

  if (selErr) throw selErr;

  if (rows && rows.length) {
    const row = rows[0];
    const anzahl = Number(row.anzahl) + menge;
    const umsatz = Number(row.umsatz) + menge * preis;

    const { error: updErr } = await supabase
      .from("tagesartikel")
      .update({ anzahl, umsatz })
      .eq("id", row.id);

    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase.from("tagesartikel").insert([
      {
        datum,
        produkt_id,
        anzahl: menge,
        umsatz: menge * preis,
      },
    ]);
    if (insErr) throw insErr;
  }
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { todayKey } from "../lib/dates";
import { fmtEUR } from "../lib/currency";

export default function Tagesuebersicht() {
  const [zeilen, setZeilen] = useState([]); // [{name, ep, anzahl, gp}]
  const [offenDeckel, setOffenDeckel] = useState(0);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  // ===== ZÄHLMASKE =====
  const NOMINALS = [
    { label: "200 €", value: 200 },
    { label: "100 €", value: 100 },
    { label: "50 €",  value: 50 },
    { label: "20 €",  value: 20 },
    { label: "10 €",  value: 10 },
    { label: "5 €",   value: 5 },
    { label: "2 €",   value: 2 },
    { label: "1 €",   value: 1 },
    { label: "50 ct", value: 0.5 },
    { label: "20 ct", value: 0.2 },
    { label: "10 ct", value: 0.1 },
  ];
  const [counts, setCounts] = useState(
    NOMINALS.reduce((acc, n) => ({ ...acc, [n.value]: "" }), {})
  );
  const gezahltGezählt = useMemo(() => {
    return NOMINALS.reduce((sum, n) => {
      const c = Number(String(counts[n.value]).replace(",", ".")) || 0;
      return sum + c * n.value;
    }, 0);
  }, [counts]);

  const datum = todayKey();

  useEffect(() => {
    (async () => {
      setErr(null);
      // Aggregation je Produkt (heute)
      const { data, error } = await supabase
        .from("tagesartikel")
        .select("anzahl, umsatz, produkt_id, produkte(name, preis:preis)")
        .eq("datum", datum);

      if (error) return setErr(error.message);

      const map = new Map();
      (data ?? []).forEach((r) => {
        const key = r.produkt_id;
        const name = r.produkte?.name ?? "";
        const ep = Number(r.produkte?.preis) || 0;
        const anzahl = Number(r.anzahl) || 0;
        const gp = Number(r.umsatz) || anzahl * ep;
        const cur = map.get(key) || { name, ep, anzahl: 0, gp: 0 };
        cur.anzahl += anzahl;
        cur.gp += gp;
        map.set(key, cur);
      });
      setZeilen([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));

      // Summe offener Deckel (heute)
      const { data: d2, error: e2 } = await supabase
        .from("deckel_offen")
        .select("betrag")
        .eq("datum", datum);
      if (e2) return setErr(e2.message);
      const sumOffen = (d2 ?? []).reduce((a, b) => a + Number(b.betrag || 0), 0);
      setOffenDeckel(sumOffen);
    })();
  }, [datum]);

  const gesamtUmsatz = useMemo(
    () => zeilen.reduce((a, z) => a + z.gp, 0),
    [zeilen]
  );
  const barHeute = Math.max(0, gesamtUmsatz - offenDeckel);
  const differenz = gezahltGezählt - barHeute;

  async function umsatzInsKassenbuch() {
    setMsg(null);
    setErr(null);
    try {
      if (barHeute <= 0) throw new Error("Kein barer Umsatz für heute.");
      const { error } = await supabase
        .from("kassenbuch")
        .insert({ art: "ein", betrag: barHeute, text: "Tagesabschluss (bar)" });
      if (error) throw error;
      setMsg("Umsatz übertragen.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h2>Tagesübersicht ({datum})</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      <table style={{ width: "100%", maxWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Artikel</th>
            <th>EP</th>
            <th>Anz.</th>
            <th>GP</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.name}>
              <td>{z.name}</td>
              <td>{fmtEUR(z.ep)}</td>
              <td>{z.anzahl}</td>
              <td>{fmtEUR(z.gp)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ textAlign: "right" }}>
              <b>Gesamtumsatz (verkauft)</b>
            </td>
            <td>{fmtEUR(gesamtUmsatz)}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ textAlign: "right" }}>
              Offen auf Deckel (heute)
            </td>
            <td>{fmtEUR(offenDeckel)}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ textAlign: "right" }}>
              Davon bar bezahlt
            </td>
            <td>{fmtEUR(barHeute)}</td>
          </tr>
        </tbody>
      </table>

      {/* ===== ZÄHLMASKE ===== */}
      <div style={{ marginTop: 16, maxWidth: 800 }}>
        <h3>Kassenbestand zählen</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          {NOMINALS.map((n) => (
            <div key={n.value}>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>
                {n.label} – Anzahl
              </label>
              <input
                value={counts[n.value]}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [n.value]: e.target.value }))
                }
                inputMode="numeric"
                placeholder="0"
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <div>Gezählt: <b>{fmtEUR(gezahltGezählt)}</b></div>
          <div>Abgleich (gezählt – bar bezahlt): <b>{fmtEUR(differenz)}</b></div>
        </div>
      </div>

      <button onClick={umsatzInsKassenbuch} style={{ marginTop: 12 }}>
        Umsatz ins Kassenbuch übertragen
      </button>
    </div>
  );
}

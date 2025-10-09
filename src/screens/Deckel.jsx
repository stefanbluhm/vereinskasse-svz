import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";
import { addToTagesartikel } from "../lib/tagesartikel";

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({}); // { produkt_id: { menge, preis, name } }
  const [gegeben, setGegeben] = useState("");   // bar
  const [rest, setRest] = useState("");         // Papierdeckel (auto-berechnet)
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("produkte")
        .select("*")
        .order("name", { ascending: true });
      if (error) setErr(error.message);
      setProdukte(data ?? []);
    })();
  }, []);

  const summe = useMemo(
    () => Object.values(korb).reduce((a, b) => a + b.menge * b.preis, 0),
    [korb]
  );

  // Menge +/- --------------------------------
  const plus = (p) =>
    setKorb((k) => ({
      ...k,
      [p.id]: { menge: (k[p.id]?.menge ?? 0) + 1, preis: p.preis, name: p.name },
    }));

  const minus = (p) =>
    setKorb((k) => {
      const cur = k[p.id]?.menge ?? 0;
      if (cur <= 1) {
        const { [p.id]: _drop, ...rest } = k;
        return rest;
      }
      return { ...k, [p.id]: { menge: cur - 1, preis: p.preis, name: p.name } };
    });

  // „Rest (Papierdeckel)“ automatisch befüllen,
  // wenn weniger gegeben wurde als zu zahlen ist.
  useEffect(() => {
    const g = Number(String(gegeben).replace(",", ".")) || 0;
    const zuZahlen = Math.max(0, summe - (Number(rest) || 0));
    const offenerTeil = Math.max(0, summe - g);
    if (g > 0 && offenerTeil > 0) {
      setRest(offenerTeil.toFixed(2));
    }
  }, [gegeben, summe]); // bewusst keine Abhängigkeit von rest

  const liste = useMemo(
    () =>
      produkte.map((p) => ({
        ...p,
        menge: korb[p.id]?.menge ?? 0,
        gp: (korb[p.id]?.menge ?? 0) * p.preis,
      })),
    [produkte, korb]
  );

  async function buchen() {
    setMsg(null);
    setErr(null);
    const datum = todayKey();

    try {
      if (summe <= 0) throw new Error("Bitte Artikel auswählen.");

      // 1) Tagesartikel fortschreiben
      for (const pid of Object.keys(korb)) {
        const item = korb[pid];
        await addToTagesartikel({
          datum,
          produkt_id: pid,
          menge: item.menge,
          preis: item.preis,
        });
      }

      // 2) Offener Deckel (Papier) heute speichern
      const restNum =
        Number(String(rest).replace(",", ".")) > 0
          ? Number(String(rest).replace(",", "."))
          : 0;

      if (restNum > 0) {
        const { error: e2 } = await supabase
          .from("deckel_offen")
          .insert({ datum, betrag: restNum });
        if (e2) throw e2;
      }

      // 3) Optional: Trinkgeld ins Kassenbuch (nur, wenn wirklich > 0)
      // (Kannst du deaktivieren, wenn vorerst nicht gewünscht.)
      const gNum = Number(String(gegeben).replace(",", ".")) || 0;
      const zuZahlen = Math.max(0, summe - restNum);
      const trinkgeld = Math.max(0, gNum - zuZahlen);
      if (trinkgeld > 0) {
        const { error: e3 } = await supabase
          .from("kassenbuch")
          .insert({ art: "trinkgeld", betrag: trinkgeld, text: "Trinkgeld" });
        if (e3) throw e3;
      }

      // UI reset
      setKorb({});
      setGegeben("");
      setRest("");
      setMsg("Verbucht.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h2>Deckel</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      <table style={{ width: "100%", maxWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Artikel</th>
            <th>EP</th>
            <th>Anz.</th>
            <th>GP</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{fmtEUR(p.preis)}</td>
              <td>{p.menge}</td>
              <td>{fmtEUR(p.gp)}</td>
              <td>
                <button onClick={() => minus(p)}>−</button>{" "}
                <button onClick={() => plus(p)}>+</button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ textAlign: "right" }}>
              <b>Summe</b>
            </td>
            <td colSpan={2}>{fmtEUR(summe)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ maxWidth: 800, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label>
            Gegeben (bar)
            <input
              value={gegeben}
              onChange={(e) => setGegeben(e.target.value)}
              inputMode="decimal"
              placeholder="z. B. 45,00"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            Rest (Papierdeckel)
            <input
              value={rest}
              onChange={(e) => setRest(e.target.value)}
              inputMode="decimal"
              placeholder="z. B. 1,50"
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div style={{ marginTop: 6 }}>
          <div>
            Zu zahlen <b>{fmtEUR(Math.max(0, summe - (Number(rest) || 0)))}</b>
          </div>
          <div>
            Offen (Deckel) <b>{fmtEUR(Number(rest) || 0)}</b>
          </div>
        </div>

        <button onClick={buchen} style={{ marginTop: 10 }}>
          BUCHEN
        </button>
      </div>
    </div>
  );
}

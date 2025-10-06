import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";
import { addToTagesartikel } from "../lib/tagesartikel";

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({}); // { produkt_id: {menge, preis} }
  const [gegeben, setGegeben] = useState("");
  const [restInput, setRestInput] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    supabase
      .from("produkte")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setProdukte(data ?? []);
      });
  }, []);

  const summe = useMemo(
    () => Object.values(korb).reduce((a, b) => a + b.menge * b.preis, 0),
    [korb]
  );

  const rest = useMemo(() => {
    const v = Number(String(restInput || 0).replace(",", "."));
    if (!isFinite(v) || v < 0) return 0;
    return Math.min(v, summe);
  }, [restInput, summe]);

  const zielZuZahlen = useMemo(() => Math.max(0, summe - rest), [summe, rest]);

  const trinkgeld = useMemo(() => {
    if (!gegeben) return 0;
    const g = Number(String(gegeben).replace(",", "."));
    if (!isFinite(g) || g <= 0) return 0;
    return Math.max(0, g - zielZuZahlen);
  }, [gegeben, zielZuZahlen]);

  const add = (p) =>
    setKorb((k) => ({
      ...k,
      [p.id]: { menge: (k[p.id]?.menge ?? 0) + 1, preis: p.preis },
    }));

  const sub = (p) =>
    setKorb((k) => {
      const cur = k[p.id]?.menge ?? 0;
      if (cur <= 1) {
        const { [p.id]: _drop, ...restk } = k;
        return restk;
      }
      return { ...k, [p.id]: { menge: cur - 1, preis: p.preis } };
    });

  const liste = useMemo(
    () => produkte.filter((p) => p.aktiv).map((p) => ({ ...p, menge: korb[p.id]?.menge ?? 0 })),
    [produkte, korb]
  );

  async function buchen() {
    setMsg(null); setErr(null);
    if (summe <= 0) {
      setErr("Bitte Artikel hinzufügen.");
      return;
    }
    const datum = todayKey();

    try {
      // Nur Tagesartikel updaten – NICHT mehr ins Kassenbuch schreiben!
      for (const pid of Object.keys(korb)) {
        const item = korb[pid];
        await addToTagesartikel({
          datum,
          produkt_id: pid,
          menge: item.menge,
          preis: item.preis,
        });
      }

      setKorb({});
      setGegeben("");
      setRestInput("");
      setMsg("Verbucht (Tagesübersicht aktualisiert). Kassenbuch bitte im Tab 'Kassenbuch' buchen.");
    } catch (e) {
      setErr(e.message);
    }
  }


  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Deckel</h2>

      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      {/* PRODUKT-KARTEN als Grid: nebeneinander mit automatischem Umbruch */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {liste.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              padding: "12px",
              background: "#fafafa",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 140,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>{fmtEUR(p.preis)}</div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: 10,
              }}
            >
              <button
                onClick={() => sub(p)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                }}
              >
                −
              </button>
              <div style={{ minWidth: 24, textAlign: "center" }}>{p.menge}</div>
              <button
                onClick={() => add(p)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "white",
                  border: "1px solid #1d4ed8",
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SUMMEN-/EINGABE-BOX */}
      <div className="rounded-2xl border p-3 space-y-3" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex justify-between">
          <div>Summe</div>
          <div>{fmtEUR(summe)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label className="block text-sm font-medium">Rest (Papierdeckel)</label>
            <input
              value={restInput}
              inputMode="decimal"
              onChange={(e) => setRestInput(e.target.value)}
              className="w-full border rounded-xl p-2"
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Gegeben (bar)</label>
            <input
              value={gegeben}
              inputMode="decimal"
              onChange={(e) => setGegeben(e.target.value)}
              className="w-full border rounded-xl p-2"
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}
            />
          </div>
        </div>

        <div className="flex justify-between">
          <div>Zu zahlen</div>
          <div>{fmtEUR(zielZuZahlen)}</div>
        </div>
        <div className="flex justify-between">
          <div>Trinkgeld</div>
          <div>{fmtEUR(trinkgeld)}</div>
        </div>
      </div>

      <button
        onClick={buchen}
        className="w-full py-3 rounded-2xl bg-green-600 text-white font-semibold"
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 14,
          background: "#16a34a",
          color: "white",
          fontWeight: 600,
          border: 0,
        }}
      >
        BUCHEN
      </button>
    </div>
  );
}

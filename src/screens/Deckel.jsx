import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";
import { addToTagesartikel } from "../lib/tagesartikel";

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({});        // {produkt_id: {menge, preis}}
  const [gegeben, setGegeben] = useState("");  // Eingabe-String
  const [restInput, setRestInput] = useState(""); // Eingabe-String
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    supabase.from("produkte").select("*").order("name", { ascending: true })
      .then(({ data, error }) => error ? setErr(error.message) : setProdukte(data ?? []));
  }, []);

  const summe = useMemo(
    () => Object.values(korb).reduce((a, b) => a + b.menge * b.preis, 0),
    [korb]
  );

  // numerische Ableitungen aus Eingaben
  const numGegeben = useMemo(() => {
    const n = Number(String(gegeben).replace(",", "."));
    return isFinite(n) && n > 0 ? n : 0;
  }, [gegeben]);

  const numRest = useMemo(() => {
    const n = Number(String(restInput).replace(",", "."));
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, summe);
  }, [restInput, summe]);

  const zuZahlen = useMemo(() => Math.max(0, summe - numRest), [summe, numRest]);
  const trinkgeld = useMemo(() => Math.max(0, numGegeben - zuZahlen), [numGegeben, zuZahlen]);

  // ⬇️ Auto-Befüllung: wenn „gegeben“ kleiner als zu zahlen, Rest = Summe - gegeben
  useEffect(() => {
    if (summe <= 0) return;
    const berechnet = Math.max(0, summe - numGegeben);
    // nur setzen, wenn es wirklich kleiner ist und der User den Rest nicht manuell überschreibt
    const jetzt = Number(String(restInput).replace(",", "."));
    const aktuell = isFinite(jetzt) ? jetzt : 0;
    if (numGegeben > 0 && berechnet !== aktuell) {
      setRestInput(berechnet.toFixed(2).replace(".", ","));
    }
  }, [numGegeben, summe]); // bewusst restInput NICHT als dependency

  const add = (p) =>
    setKorb((k) => ({ ...k, [p.id]: { menge: (k[p.id]?.menge ?? 0) + 1, preis: p.preis } }));

  const sub = (p) =>
    setKorb((k) => {
      const cur = k[p.id]?.menge ?? 0;
      if (cur <= 1) {
        const { [p.id]: _drop, ...rest } = k;
        return rest;
      }
      return { ...k, [p.id]: { menge: cur - 1, preis: p.preis } };
    });

  const liste = useMemo(
    () => produkte.filter(p => p.aktiv).map((p) => ({ ...p, menge: korb[p.id]?.menge ?? 0 })),
    [produkte, korb]
  );

  async function buchen() {
    setMsg(null); setErr(null);
    if (summe <= 0) { setErr("Bitte Artikel hinzufügen."); return; }

    const datum = todayKey();

    try {
      // 1) Tagesartikel hochzählen
      for (const pid of Object.keys(korb)) {
        const item = korb[pid];
        await addToTagesartikel({ datum, produkt_id: pid, menge: item.menge, preis: item.preis });
      }

      // 2) Barzahlung + Trinkgeld ins Kassenbuch (Rest bleibt offen = Deckel)
      const inserts = [];
      if (zuZahlen > 0) inserts.push({ art: "ein", betrag: zuZahlen, text: "Verkauf (Deckel)" });
      if (trinkgeld > 0) inserts.push({ art: "trinkgeld", betrag: trinkgeld, text: "Trinkgeld" });
      if (inserts.length) {
        const { error } = await supabase.from("kassenbuch").insert(inserts);
        if (error) throw error;
      }

      setKorb({}); setGegeben(""); setRestInput(""); setMsg("Verbucht.");
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Deckel</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      {/* Produkt-Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {liste.map((p) => (
          <div key={p.id} className="rounded-2xl border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500 mb-2">{fmtEUR(p.preis)}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => sub(p)} className="px-3 py-1 rounded-xl bg-gray-100">−</button>
              <div className="w-8 text-center">{p.menge}</div>
              <button onClick={() => add(p)} className="px-3 py-1 rounded-xl bg-blue-600 text-white">+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Summen & Eingaben */}
      <div className="rounded-2xl border p-3 space-y-3">
        <Row label="Summe" value={fmtEUR(summe)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Rest (Papierdeckel)"
            value={restInput}
            onChange={setRestInput}
          />
          <Field
            label="Gegeben (bar)"
            value={gegeben}
            onChange={setGegeben}
          />
        </div>
        <Row label="Zu zahlen"  value={fmtEUR(zuZahlen)} />
        <Row label="Trinkgeld" value={fmtEUR(trinkgeld)} />
      </div>

      <button onClick={buchen} className="w-full py-3 rounded-2xl bg-green-600 text-white font-semibold">
        BUCHEN
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div>{label}</div><div>{value}</div>
    </div>
  );
}
function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1">{label}</div>
      <input
        className="w-full border rounded-xl p-2"
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

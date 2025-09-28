import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";
import { addToTagesartikel } from "../lib/tagesartikel";

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({}); // {produkt_id: {menge, preis}}
  const [gegeben, setGegeben] = useState("");
  const [restInput, setRestInput] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    supabase.from("produkte").select("*").order("name", { ascending: true })
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
    setKorb((k) => ({ ...k, [p.id]: { menge: (k[p.id]?.menge ?? 0) + 1, preis: p.preis } }));

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
    () => produkte.filter(p => p.aktiv).map((p) => ({ ...p, menge: korb[p.id]?.menge ?? 0 })),
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
      // Tagesartikel updaten
      for (const pid of Object.keys(korb)) {
        const item = korb[pid];
        await addToTagesartikel({ datum, produkt_id: pid, menge: item.menge, preis: item.preis });
      }

      // Barzahlung + Trinkgeld ins Kassenbuch (optional)
      const inserts = [];
      if (zielZuZahlen > 0) inserts.push({ art: "ein", betrag: zielZuZahlen, text: "Verkauf (Deckel)" });
      if (trinkgeld > 0)  inserts.push({ art: "trinkgeld", betrag: trinkgeld, text: "Trinkgeld" });
      if (inserts.length) {
        const { error } = await supabase.from("kassenbuch").insert(inserts);
        if (error) throw error;
      }

      setKorb({});
      setGegeben("");
      setRestInput("");
      setMsg("Verbucht.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Deckel</h2>

      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}
      {msg && <div style={{color:"green"}}>{msg}</div>}

      <div className="divide-y rounded-2xl border">
        {liste.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-2">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-500">{fmtEUR(p.preis)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => sub(p)} className="px-3 py-1 rounded-xl bg-gray-100">−</button>
              <div className="w-8 text-center">{p.menge}</div>
              <button onClick={() => add(p)} className="px-3 py-1 rounded-xl bg-blue-600 text-white">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-3 space-y-3">
        <div className="flex justify-between"><div>Summe</div><div>{fmtEUR(summe)}</div></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label>Rest (Papierdeckel)</label>
            <input value={restInput} inputMode="decimal" onChange={(e)=>setRestInput(e.target.value)} className="w-full border rounded-xl p-2" />
          </div>
          <div>
            <label>Gegeben (bar)</label>
            <input value={gegeben} inputMode="decimal" onChange={(e)=>setGegeben(e.target.value)} className="w-full border rounded-xl p-2" />
          </div>
        </div>
        <div className="flex justify-between"><div>Zu zahlen</div><div>{fmtEUR(zielZuZahlen)}</div></div>
        <div className="flex justify-between"><div>Trinkgeld</div><div>{fmtEUR(trinkgeld)}</div></div>
      </div>

      <button onClick={buchen} className="w-full py-3 rounded-2xl bg-green-600 text-white font-semibold">BUCHEN</button>
    </div>
  );
}

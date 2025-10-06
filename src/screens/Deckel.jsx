import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

/** Helfer für Rundung */
const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({}); // {produkt_id: {anzahl, preis, name}}
  const [gegeben, setGegeben] = useState("");
  const [restInput, setRestInput] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("produkte").select("*")
        .order("name", { ascending: true });
      if (error) setErr(error.message);
      else setProdukte(data ?? []);
    })();
  }, []);

  const summe = useMemo(() =>
    Object.values(korb).reduce((a, b) => a + b.anzahl * b.preis, 0),
  [korb]);

  // Auto-Rest: wenn gegeben < zu zahlen, fülle Rest automatisch
  const restAuto = useMemo(() => {
    const g = toNum(gegeben);
    // Rest ist der Teil, der NICHT bezahlt wurde (Papierdeckel)
    const vorlZahlen = Math.max(0, summe - toNum(restInput));
    if (g > 0 && g < vorlZahlen) {
      return Math.max(0, summe - g);
    }
    return toNum(restInput);
  }, [gegeben, restInput, summe]);

  const zuZahlen = useMemo(() =>
    Math.max(0, summe - restAuto),
  [summe, restAuto]);

  const add = (p) =>
    setKorb((k) => ({
      ...k,
      [p.id]: { name: p.name, preis: p.preis, anzahl: (k[p.id]?.anzahl ?? 0) + 1 },
    }));

  const sub = (p) =>
    setKorb((k) => {
      const cur = k[p.id]?.anzahl ?? 0;
      if (cur <= 1) {
        const { [p.id]: _drop, ...rest } = k;
        return rest;
      }
      return { ...k, [p.id]: { ...k[p.id], anzahl: cur - 1 } };
    });

  const liste = useMemo(
    () => produkte.filter(p => p.aktiv).map((p) => ({ ...p, anzahl: korb[p.id]?.anzahl ?? 0 })),
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
      // Tagesartikel aktualisieren (anzahl & umsatz)
      for (const pid of Object.keys(korb)) {
        const { anzahl, preis } = korb[pid];
        const umsatz = Number((anzahl * preis).toFixed(2));
        // Upsert pro (datum, produkt_id)
        const { error } = await supabase
          .from("tagesartikel")
          .upsert({ datum, produkt_id: pid, anzahl, umsatz }, { onConflict: "datum,produkt_id" });
        if (error) throw error;
      }

      // Barzahlung (ohne Trinkgeld) direkt ins Kassenbuch
      if (zuZahlen > 0) {
        const { error } = await supabase
          .from("kassenbuch")
          .insert([{ art: "ein", betrag: zuZahlen, text: "Verkauf (Deckel)" }]);
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Deckel</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      {/* Tabelle der Produkte */}
      <table className="w-full border rounded-2xl overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Artikel</th>
            <th className="p-2 text-right">EP</th>
            <th className="p-2 text-center">Anz.</th>
            <th className="p-2 text-right">GP</th>
            <th className="p-2 text-center">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((p) => {
            const gp = p.anzahl * p.preis;
            return (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-right">{fmtEUR(p.preis)}</td>
                <td className="p-2 text-center">{p.anzahl}</td>
                <td className="p-2 text-right">{fmtEUR(gp)}</td>
                <td className="p-2 text-center">
                  <div className="inline-flex gap-2">
                    <button className="px-2 rounded bg-gray-100" onClick={() => sub(p)}>−</button>
                    <button className="px-2 rounded bg-blue-600 text-white" onClick={() => add(p)}>+</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="p-2 font-semibold" colSpan={3}>Summe</td>
            <td className="p-2 text-right font-semibold">{fmtEUR(summe)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {/* Eingaben */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span>Gegeben (bar)</span>
          <input
            value={gegeben}
            inputMode="decimal"
            onChange={(e) => setGegeben(e.target.value)}
            className="border rounded-xl p-2"
            placeholder="z. B. 10"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Rest (Papierdeckel)</span>
          <input
            value={restAuto === toNum(restInput) ? restInput : String(restAuto).replace(".", ",")}
            onChange={(e) => setRestInput(e.target.value)}
            inputMode="decimal"
            className="border rounded-xl p-2"
            placeholder="z. B. 1,50"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex justify-between border rounded-xl p-2">
          <span>Zu zahlen</span>
          <strong>{fmtEUR(zuZahlen)}</strong>
        </div>
        <div className="flex justify-between border rounded-xl p-2">
          <span>Offen (Deckel)</span>
          <strong>{fmtEUR(restAuto)}</strong>
        </div>
      </div>

      <button onClick={buchen} className="w-full py-3 rounded-2xl bg-green-600 text-white font-semibold">
        BUCHEN
      </button>
    </div>
  );
}
// Hilfsfunktion (oben im File)
const parseDec = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// ... im Komponenten-Body:
useEffect(() => {
  const g = parseDec(gegeben);
  if (g > 0) {
    // offener Betrag = Summe - gegeben, minimal 0
    const offen = Math.max(0, summe - g);
    // wenn offen > 0 -> Rest automatisch setzen, sonst leeren
    setRestInput(offen > 0 ? offen.toFixed(2) : "");
  }
}, [gegeben, summe]);


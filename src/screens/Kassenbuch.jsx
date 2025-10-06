import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { todayKey } from "../lib/dates";
import { fmtEUR } from "../lib/currency";

const DENOMS = [200,100,50,20,10,5,2,1,0.5,0.2,0.1];

export default function Kassenbuch() {
  const [barHeute, setBarHeute] = useState(0);     // aus Tagesübersicht (heute bar)
  const [trinkgeldHeute, setTrinkgeldHeute] = useState(""); // manuell
  const [eintraege, setEintraege] = useState([]);
  const [counts, setCounts] = useState(Object.fromEntries(DENOMS.map(v => [v, ""])));
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      const datum = todayKey();

      // bar bezahlt heute
      const { data: kbEin, error: e1 } = await supabase
        .from("kassenbuch").select("betrag, art, text, created_at")
        .gte("created_at", `${datum} 00:00:00`).lte("created_at", `${datum} 23:59:59`);
      if (e1) return setErr(e1.message);

      setEintraege(kbEin ?? []);

      const bar = (kbEin ?? []).filter(r => r.art === "ein" && r.text === "Verkauf (Deckel)")
        .reduce((a, r) => a + (r.betrag ?? 0), 0);
      setBarHeute(bar);
    })();
  }, []);

  const gezahltGezählt = useMemo(() =>
    DENOMS.reduce((sum, v) => {
      const n = Number(String(counts[v]).replace(",", "."));
      const anz = isFinite(n) && n > 0 ? n : 0;
      return sum + anz * v;
    }, 0), [counts]);

  async function tagesabschlussBuchen() {
    setErr(null);
    const tg = Number(String(trinkgeldHeute).replace(",", "."));
    const inserts = [];
    if (barHeute > 0) inserts.push({ art: "ein", betrag: barHeute, text: "Tagesumsatz (bar)" });
    if (isFinite(tg) && tg > 0) inserts.push({ art: "trinkgeld", betrag: tg, text: "Trinkgeld (manuell)" });
    if (!inserts.length) return;

    const { error } = await supabase.from("kassenbuch").insert(inserts);
    if (error) setErr(error.message);
    else window.location.reload();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Kassenbuch</h2>
      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card label="Gesamtumsatz heute (bar erfasst über Deckel)" value={fmtEUR(barHeute)} />
        <div className="rounded-2xl border p-3">
          <div className="text-sm text-gray-500">Trinkgeld (heute, manuell)</div>
          <input
            className="mt-2 w-full border rounded-xl p-2"
            value={trinkgeldHeute}
            onChange={(e)=>setTrinkgeldHeute(e.target.value)}
            placeholder="z.B. 1,50"
            inputMode="decimal"
          />
          <button className="mt-3 w-full px-4 py-2 rounded-2xl bg-green-600 text-white"
                  onClick={tagesabschlussBuchen}>
            Tagesabschluss ins Kassenbuch buchen
          </button>
        </div>
      </div>

      {/* Kassenbestand zählen */}
      <div className="rounded-2xl border p-3">
        <div className="font-medium mb-2">Kassenbestand zählen</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {DENOMS.map(v => (
            <label key={v} className="border rounded-xl p-2 flex items-center justify-between gap-2">
              <div>{v >= 1 ? `${v.toFixed(0)} €` : `${(v*100).toFixed(0)} ct`}</div>
              <input
                className="w-20 border rounded-xl p-1 text-right"
                value={counts[v]}
                inputMode="numeric"
                onChange={(e)=>setCounts(c => ({...c, [v]: e.target.value}))}
                placeholder="Anzahl"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>Gezählter Bestand</div>
          <div className="font-semibold">{fmtEUR(gezahltGezählt)}</div>
        </div>
      </div>

      {/* Heutige Buchungen */}
      <div className="rounded-2xl border p-3">
        <div className="font-medium mb-2">Heute gebuchte Einträge</div>
        <ul className="space-y-1">
          {(eintraege ?? []).map((r, i) => (
            <li key={i} className="flex items-center justify-between">
              <div>{new Date(r.created_at).toLocaleString()} – {r.text ?? r.art}</div>
              <div>{fmtEUR(r.betrag ?? 0)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function Card({label, value}) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

export default function Tagesuebersicht() {
  const dkey = todayKey(); // YYYY-MM-DD

  const [zeilen, setZeilen] = useState([]);      // [{name, anzahl, umsatz}]
  const [barEinnahmen, setBarEinnahmen] = useState(0);
  const [trinkgeld, setTrinkgeld] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Zählmaske
  const DENOMS = [200,100,50,20,10,5,2,1,0.5,0.2,0.1,0.05];
  const [counts, setCounts] = useState({});   // { denom: qty }
  const [notiz, setNotiz] = useState("");
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Verkäufe des Tages (join tagesartikel + produkte)
        const { data: ta, error: e1 } = await supabase
          .from("tagesartikel")
          .select("produkt_id, anzahl, umsatz, produkte(name)")
          .eq("datum", dkey)
          .order("produkt_id");
        if (e1) throw e1;

        const zusammen = (ta ?? []).map(r => ({
          name: r.produkte?.name ?? r.produkt_id,
          anzahl: r.anzahl ?? 0,
          umsatz: r.umsatz ?? 0
        })).sort((a,b)=>a.name.localeCompare(b.name));
        setZeilen(zusammen);

        // 2) Kassenbuch heute (bar + trinkgeld)
        const { data: kb, error: e2 } = await supabase
          .from("kassenbuch")
          .select("art, betrag, created_at")
          .gte("created_at", `${dkey}T00:00:00`)
          .lte("created_at", `${dkey}T23:59:59`);
        if (e2) throw e2;

        const bar = (kb ?? []).filter(e=>e.art==="ein").reduce((a,b)=>a+b.betrag,0);
        const tg = (kb ?? []).filter(e=>e.art==="trinkgeld").reduce((a,b)=>a+b.betrag,0);
        setBarEinnahmen(bar);
        setTrinkgeld(tg);

        // 3) Zählung laden
        const { data: z, error: e3 } = await supabase
          .from("zaehlung")
          .select("*")
          .eq("datum", dkey)
          .maybeSingle();
        if (e3) throw e3;
        if (z) {
          setCounts(z.counts || {});
          setNotiz(z.notiz || "");
          setLastSaved(z.updated_at || z.created_at || null);
        } else {
          setCounts({});
          setNotiz("");
          setLastSaved(null);
        }
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [dkey]);

  const gesamtUmsatz = useMemo(
    () => zeilen.reduce((a,b)=>a+b.umsatz,0),
    [zeilen]
  );

  const sumCent = useMemo(()=> DENOMS.reduce((acc, d)=>{
    const qty = Number(counts[d]||0) || 0;
    const cents = Math.round(d * 100);
    return acc + qty * cents;
  }, 0), [counts]);
  const sumGezählt = useMemo(()=> (sumCent/100), [sumCent]);

  const setQty = (d, v) => setCounts(c => ({...c, [d]: Math.max(0, Number(v||0))}));
  const inc = (d) => setCounts(c=>({...c, [d]: (c[d]||0)+1 }));
  const dec = (d) => setCounts(c=>{ const q=(c[d]||0)-1; return {...c, [d]: Math.max(0,q)} });

  async function speichern() {
    try {
      setErr(null);
      const { error } = await supabase
        .from("zaehlung")
        .upsert({
          datum: dkey,
          counts,
          summe: sumGezählt,
          notiz,
          updated_at: new Date().toISOString()
        }, { onConflict: "datum" });
      if (error) throw error;
      setLastSaved(new Date().toISOString());
      alert("Kassenbestand gespeichert.");
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tagesübersicht ({dkey})</h2>

      {err && <div className="text-sm text-red-600">Fehler: {err}</div>}
      {loading && <div className="text-sm text-gray-500">Lade…</div>}

      {/* Karten: Verkäufe des Tages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {zeilen.length===0 && !loading && (
          <div className="col-span-full text-sm text-gray-500">Noch keine Buchungen heute.</div>
        )}
        {zeilen.map((z, i)=>(
          <div key={i} className="rounded-2xl border p-4">
            <div className="text-base font-medium">{z.name}</div>
            <div className="mt-2 text-sm text-gray-500">Anzahl</div>
            <div className="text-xl">{z.anzahl}</div>
            <div className="mt-2 text-sm text-gray-500">Umsatz</div>
            <div className="text-lg font-semibold">{fmtEUR(z.umsatz)}</div>
          </div>
        ))}
      </div>

      {/* Summen-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Gesamtumsatz (verkauft)</div>
          <div className="text-xl font-semibold">{fmtEUR(gesamtUmsatz)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Davon bar gezahlt</div>
          <div className="text-xl font-semibold">{fmtEUR(barEinnahmen)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Trinkgeld (heute)</div>
          <div className="text-xl font-semibold">{fmtEUR(trinkgeld)}</div>
        </div>
      </div>

      {/* Zählmaske */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Kassenbestand zählen</h3>
          {lastSaved && (
            <div className="text-xs text-gray-500">
              Zuletzt gespeichert: {new Date(lastSaved).toLocaleString()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {DENOMS.map(d=>(
            <div key={d} className="flex items-center justify-between border rounded-xl p-2">
              <div className="text-sm">
                {d >= 5
                  ? fmtEUR(d)
                  : `${(d).toLocaleString('de-DE',{minimumFractionDigits:2})} €`}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>dec(d)} className="px-2 py-1 rounded-lg bg-gray-100">−</button>
                <input
                  inputMode="numeric"
                  value={counts[d]||""}
                  onChange={e=>setQty(d, e.target.value)}
                  className="w-16 text-center border rounded-lg p-1"
                  placeholder="0"
                />
                <button onClick={()=>inc(d)} className="px-2 py-1 rounded-lg bg-gray-100">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="font-medium">Summe gezählt</div>
          <div className="text-lg font-semibold">{fmtEUR(sumGezählt)}</div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notiz (optional)</label>
          <input
            value={notiz}
            onChange={e=>setNotiz(e.target.value)}
            className="w-full border rounded-xl p-2"
            placeholder="z.B. Startbestand 100 €"
          />
        </div>

        <button onClick={speichern} className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold">
          Kassenbestand speichern
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

export default function Tagesuebersicht() {
  const dkey = todayKey();

  const [zeilen, setZeilen] = useState([]); // [{name, anzahl, umsatz}]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data, error } = await supabase
          .from("tagesartikel")
          .select("produkt_id, anzahl, umsatz, produkte(name)")
          .eq("datum", dkey)
          .order("produkt_id");
        if (error) throw error;

        const rows = (data ?? [])
          .map(r => ({
            name: r.produkte?.name ?? r.produkt_id,
            anzahl: r.anzahl ?? 0,
            umsatz: r.umsatz ?? 0,
          }))
          .sort((a,b)=>a.name.localeCompare(b.name));

        setZeilen(rows);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [dkey]);

  const gesamtUmsatz = useMemo(
    () => zeilen.reduce((a,b)=>a + (b.umsatz || 0), 0),
    [zeilen]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tagesübersicht ({dkey})</h2>

      {err && <div className="text-sm text-red-600">Fehler: {err}</div>}
      {loading && <div className="text-sm text-gray-500">Lade…</div>}

      {/* Produkt-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {zeilen.length === 0 && !loading && (
          <div className="col-span-full text-sm text-gray-500">
            Noch keine Verkäufe heute.
          </div>
        )}

        {zeilen.map((z, i) => (
          <div key={i} className="rounded-2xl border p-4">
            <div className="text-base font-medium">{z.name}</div>
            <div className="mt-2 text-sm text-gray-500">Anzahl</div>
            <div className="text-xl">{z.anzahl}</div>
            <div className="mt-2 text-sm text-gray-500">Umsatz</div>
            <div className="text-lg font-semibold">{fmtEUR(z.umsatz)}</div>
          </div>
        ))}
      </div>

      {/* Summen-Karte */}
      <div className="rounded-2xl border p-4">
        <div className="text-sm text-gray-500">Gesamtumsatz (verkauft)</div>
        <div className="text-xl font-semibold">{fmtEUR(gesamtUmsatz)}</div>
      </div>
    </div>
  );
}

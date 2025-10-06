import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { todayKey } from "../lib/dates";
import { fmtEUR } from "../lib/currency";

export default function Tagesuebersicht() {
  const [positionen, setPositionen] = useState([]); // [{name, menge, umsatz}]
  const [bar, setBar] = useState(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      const datum = todayKey();

      // 1) Tagesartikel (verkauft gesamt)
      const { data: ta, error: e1 } = await supabase
        .from("tagesartikel")
        .select("produkt_id, menge, umsatz")
        .eq("datum", datum);
      if (e1) return setErr(e1.message);

      const { data: prod, error: e2 } = await supabase
        .from("produkte")
        .select("id, name, preis, aktiv");
      if (e2) return setErr(e2.message);

      const byId = new Map(prod.map(p => [p.id, p]));
      const pos = (ta ?? []).map(t => {
        const p = byId.get(t.produkt_id) || {};
        const name = p.name ?? "Artikel";
        const umsatz = (t.umsatz ?? t.menge * (p.preis ?? 0)) || 0;
        return { name, menge: t.menge ?? 0, umsatz };
      });
      setPositionen(pos);

      // 2) Bar-Einnahmen heute aus dem Kassenbuch
      const { data: kb, error: e3 } = await supabase
        .from("kassenbuch")
        .select("betrag, art, created_at")
        .eq("art", "ein")
        .gte("created_at", `${datum} 00:00:00`)
        .lte("created_at", `${datum} 23:59:59`);
      if (e3) return setErr(e3.message);

      const sumBar = (kb ?? []).reduce((a, r) => a + (r.betrag ?? 0), 0);
      setBar(sumBar);
    })();
  }, []);

  const gesamtVerkauf = useMemo(
    () => positionen.reduce((a, p) => a + p.umsatz, 0),
    [positionen]
  );
  const offenDeckel = useMemo(
    () => bar - gesamtVerkauf,                 // NEGATIV = offen
    [bar, gesamtVerkauf]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tagesübersicht ({todayKey()})</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}

      {/* Karten je Produkt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {positionen.map((p, i) => (
          <div key={i} className="rounded-2xl border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500">Anzahl: {p.menge}</div>
            <div className="text-sm">Umsatz: {fmtEUR(p.umsatz)}</div>
          </div>
        ))}
      </div>

      {/* Summenboxen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard label="Gesamtumsatz (verkauft)" value={fmtEUR(gesamtVerkauf)} />
        <SummaryCard label="Davon bar bezahlt" value={fmtEUR(bar)} />
        <SummaryCard
          label="Offen auf Deckel (heute)"
          value={fmtEUR(offenDeckel)}          // bei offenen Beträgen negativ
          emphasize={offenDeckel < 0}
        />
      </div>

      {/* Optionaler Shortcut – die eigentliche Buchung machst du im Kassenbuch */}
      <button
        className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-blue-600 text-white"
        onClick={() => window.location.assign("/#/kassenbuch")}
      >
        Umsatz ins Kassenbuch übertragen
      </button>
    </div>
  );
}

function SummaryCard({ label, value, emphasize }) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${emphasize ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

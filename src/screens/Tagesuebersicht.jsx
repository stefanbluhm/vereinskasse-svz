import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

export default function Tagesuebersicht() {
  const datum = todayKey();
  const [rows, setRows] = useState([]); // [{name, anzahl, umsatz}]
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      // Join tagesartikel + produkte
      const { data, error } = await supabase
        .from("tagesartikel")
        .select("anzahl,umsatz,produkte(name)")
        .eq("datum", datum);
      if (error) { setErr(error.message); return; }
      const list = (data ?? []).map(r => ({
        name: r.produkte?.name ?? "Unbekannt",
        anzahl: r.anzahl ?? 0,
        umsatz: Number(r.umsatz ?? 0)
      }));
      setRows(list);
    })();
  }, [datum]);

  const gesamtUmsatz = useMemo(
    () => rows.reduce((a, b) => a + b.umsatz, 0),
    [rows]
  );

  // Bar bezahlte Umsätze stehen im Kassenbuch (art='ein', text = 'Verkauf (Deckel)')
  const [barHeute, setBarHeute] = useState(0);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("kassenbuch")
        .select("betrag, created_at")
        .eq("art", "ein")
        .ilike("text", "Verkauf%"); // heutige im Client summieren
      if (error) return;
      const heute = new Date().toISOString().slice(0,10);
      const sum = (data ?? [])
        .filter(r => (r.created_at ?? "").startsWith(heute))
        .reduce((a, r) => a + Number(r.betrag ?? 0), 0);
      setBarHeute(sum);
    })();
  }, []);

  const offenDeckel = Math.max(0, gesamtUmsatz - barHeute); // minus-Ausweis automatisch

  async function umsatzInsKassenbuch() {
    setMsg(null); setErr(null);
    if (offenDeckel <= 0) { setMsg("Nichts offen."); return; }
    const { error } = await supabase
      .from("kassenbuch")
      .insert([{ art: "ein", betrag: offenDeckel, text: "Tagesabschluss (Deckel offen)" }]);
    if (error) setErr(error.message);
    else setMsg("Umsatz übertragen.");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tagesübersicht ({datum})</h2>
      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}
      {msg && <div style={{color:"green"}}>{msg}</div>}

      <table className="w-full border rounded-2xl overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Artikel</th>
            <th className="p-2 text-right">Anzahl</th>
            <th className="p-2 text-right">Umsatz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{r.name}</td>
              <td className="p-2 text-right">{r.anzahl}</td>
              <td className="p-2 text-right">{fmtEUR(r.umsatz)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="p-2 font-semibold">Gesamtumsatz (verkauft)</td>
            <td />
            <td className="p-2 text-right font-semibold">{fmtEUR(gesamtUmsatz)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-xl p-3">
          <div className="text-sm text-gray-500">Davon bar bezahlt</div>
          <div className="text-lg font-semibold">{fmtEUR(barHeute)}</div>
        </div>
        <div className="border rounded-xl p-3">
          <div className="text-sm text-gray-500">Offen auf Deckel (heute)</div>
          <div className="text-lg font-semibold">{fmtEUR(offenDeckel)}</div>
        </div>
        <div className="flex items-center">
          <button onClick={umsatzInsKassenbuch}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold">
            Umsatz ins Kassenbuch übertragen
          </button>
        </div>
      </div>

      {/* Kassenbestand zählen (Schnellmaske wie gewünscht) */}
      <KassenZaehlen />
    </div>
  );
}

function KassenZaehlen() {
  const staffel = [200,100,50,20,10,5,2,1,0.5,0.2,0.1];
  const [counts, setCounts] = useState(Object.fromEntries(staffel.map(v => [v, ""])));
  const betrag = staffel.reduce((a, v) => a + (Number(counts[v]||0)*v), 0);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Kassenbestand zählen</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {staffel.map((v) => (
          <label key={v} className="border rounded-xl p-2 flex flex-col gap-1">
            <span className="text-sm">{v>=1 ? `${v} €` : `${v*100} ct`}</span>
            <input
              value={counts[v]}
              onChange={(e)=>setCounts(s=>({...s,[v]:e.target.value}))}
              inputMode="numeric"
              className="border rounded px-2 py-1"
              placeholder="Anzahl"
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <div className="border rounded-xl p-2">Gezählt: <strong>{fmtEUR(betrag)}</strong></div>
      </div>
    </div>
  );
}

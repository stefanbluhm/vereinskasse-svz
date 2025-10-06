import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

export default function Kassenbuch() {
  const dkey = todayKey();
  const [zeilen, setZeilen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [trinkgeldInput, setTrinkgeldInput] = useState("");
  const [info, setInfo] = useState(null);

  // heute vorhandene kassenbuch-einträge anzeigen
  const [kasseneintraege, setKasseneintraege] = useState([]);

  const parseDec = (s) => {
    const v = Number(String(s || 0).replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Summe aus Tagesartikeln lesen
        const { data: ta, error: e1 } = await supabase
          .from("tagesartikel")
          .select("umsatz")
          .eq("datum", dkey);
        if (e1) throw e1;
        setZeilen(ta ?? []);

        // Heute schon gebuchte Kassenbuch-Zeilen holen
        const { data: kb, error: e2 } = await supabase
          .from("kassenbuch")
          .select("*")
          .gte("created_at", `${dkey}T00:00:00`)
          .lte("created_at", `${dkey}T23:59:59`)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        setKasseneintraege(kb ?? []);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [dkey]);

  const umsatzHeute = useMemo(
    () => (zeilen ?? []).reduce((a,b)=>a + (b.umsatz||0), 0),
    [zeilen]
  );

  async function buchenTagesabschluss() {
    try {
      setErr(null);
      setInfo(null);

      // Doppelbuchungs-Schutz
      const { data: schonDa, error: e0 } = await supabase
        .from("kassenbuch")
        .select("id")
        .eq("text", "Tagesabschluss")
        .gte("created_at", `${dkey}T00:00:00`)
        .lte("created_at", `${dkey}T23:59:59`);
      if (e0) throw e0;
      if ((schonDa ?? []).length > 0) {
        setInfo("Tagesabschluss wurde heute bereits gebucht.");
        return;
      }

      const bar = umsatzHeute;               // alles verkaufte heute als Barumsatz
      const tg  = parseDec(trinkgeldInput);  // Trinkgeld manuell

      const inserts = [];
      if (bar > 0) inserts.push({ art: "ein", betrag: bar, text: "Tagesabschluss" });
      if (tg  > 0) inserts.push({ art: "trinkgeld", betrag: tg, text: "Tagesabschluss" });

      if (inserts.length === 0) {
        setInfo("Kein Betrag zu buchen.");
        return;
      }

      const { error } = await supabase.from("kassenbuch").insert(inserts);
      if (error) throw error;

      // Liste neu laden
      const { data: kb, error: e2 } = await supabase
        .from("kassenbuch")
        .select("*")
        .gte("created_at", `${dkey}T00:00:00`)
        .lte("created_at", `${dkey}T23:59:59`)
        .order("created_at", { ascending: false });
      if (e2) throw e2;
      setKasseneintraege(kb ?? []);
      setInfo("Tagesabschluss wurde ins Kassenbuch gebucht.");
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Kassenbuch</h2>

      {err && <div className="text-sm text-red-600">Fehler: {err}</div>}
      {info && <div className="text-sm text-green-600">{info}</div>}
      {loading && <div className="text-sm text-gray-500">Lade…</div>}

      {/* Karten: Abschluss vorbereiten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Gesamtumsatz heute</div>
          <div className="text-xl font-semibold">{fmtEUR(umsatzHeute)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <label className="text-sm text-gray-500">Trinkgeld (heute, manuell)</label>
          <input
            value={trinkgeldInput}
            onChange={(e)=>setTrinkgeldInput(e.target.value)}
            inputMode="decimal"
            placeholder="z.B. 1,50"
            className="mt-2 w-full border rounded-xl p-2"
          />
        </div>
        <div className="rounded-2xl border p-4 flex items-end">
          <button
            onClick={buchenTagesabschluss}
            className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold"
          >
            Tagesabschluss ins Kassenbuch buchen
          </button>
        </div>
      </div>

      {/* Heute bereits vorhandene Kassenbuch-Zeilen */}
      <div className="rounded-2xl border p-4">
        <div className="font-medium mb-2">Heute gebuchte Einträge</div>
        {kasseneintraege.length === 0 ? (
          <div className="text-sm text-gray-500">Noch keine Einträge heute.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {kasseneintraege.map(e=>(
              <div key={e.id} className="border rounded-xl p-3">
                <div className="text-sm text-gray-500">
                  {new Date(e.created_at).toLocaleString()}
                </div>
                <div className="font-medium">{e.text || e.art}</div>
                <div className="text-lg">{fmtEUR(e.betrag)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

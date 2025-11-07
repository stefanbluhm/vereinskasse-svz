// src/screens/Deckel.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";
import { addToTagesartikel } from "../lib/tagesartikel";

// ---------- kleine Hilfen ----------
const parseEuro = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// -----------------------------------

export default function Deckel() {
  const [produkte, setProdukte] = useState([]);
  const [korb, setKorb] = useState({}); // { [produkt_id]: { menge, preis, name } }
  const [gegeben, setGegeben] = useState("");
  const [restInput, setRestInput] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // Produkte laden
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("produkte")
        .select("*")
        .order("name", { ascending: true });
      if (!alive) return;
      if (error) setErr(error.message);
      else setProdukte(data ?? []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Summe
  const summe = useMemo(() => {
    return Object.values(korb).reduce((a, b) => a + b.menge * b.preis, 0);
  }, [korb]);

  // Automatik: Rest bei Änderung von Gegeben oder Summe sinnvoll setzen
  useEffect(() => {
    const g = parseEuro(gegeben);
    const curRest = parseEuro(restInput);

    // Betrag, der *jetzt* bar zu zahlen wäre, wenn wir den aktuellen Rest annehmen
    const neededNow = Math.max(0, summe - curRest);

    let newRest = curRest;

    if (g >= summe) {
      // genug bar => kein offener Deckel
      newRest = 0;
    } else if (g > 0 && g < neededNow) {
      // zu wenig bar => fehlenden Teil automatisch als Rest (Papierdeckel)
      newRest = summe - g;
    }

    newRest = clamp(newRest, 0, summe);

    if (Math.abs(newRest - curRest) > 1e-6) {
      setRestInput(String(newRest));
    }
  }, [gegeben, summe]); // absichtlich nicht von restInput abhängig

  // abgeleitete Werte
  const rest = useMemo(
    () => clamp(parseEuro(restInput), 0, summe),
    [restInput, summe]
  );

  const zuZahlen = useMemo(() => Math.max(0, summe - rest), [summe, rest]);

  const trinkgeld = useMemo(() => {
    const g = parseEuro(gegeben);
    return Math.max(0, g - zuZahlen);
  }, [gegeben, zuZahlen]);

  const offenDeckel = rest;

  // Anzeige-Liste
  const liste = useMemo(() => {
    return produkte
      .filter((p) => p.aktiv)
      .map((p) => ({
        ...p,
        menge: korb[p.id]?.menge ?? 0,
      }));
  }, [produkte, korb]);

  // +/−
  const add = (p) =>
    setKorb((k) => ({
      ...k,
      [p.id]: { menge: (k[p.id]?.menge ?? 0) + 1, preis: p.preis, name: p.name },
    }));

  const sub = (p) =>
    setKorb((k) => {
      const cur = k[p.id]?.menge ?? 0;
      if (cur <= 1) {
        const { [p.id]: _drop, ...rest } = k;
        return rest;
      }
      return { ...k, [p.id]: { menge: cur - 1, preis: p.preis, name: p.name } };
    });

  // Buchen
  async function buchen() {
    setMsg(null);
    setErr(null);

    if (summe <= 0) {
      setErr("Bitte Artikel hinzufügen.");
      return;
    }

    const datum = todayKey();

    try {
      // 1) Tagesartikel upserten
      for (const pid of Object.keys(korb)) {
        const item = korb[pid]; // {menge, preis}
        const anzahl = Number(item.menge) || 0;
        const umsatz = Number((anzahl * Number(item.preis || 0)).toFixed(2));

        await addToTagesartikel({
          datum,
          produkt_id: pid,
          anzahl,
          umsatz,
        });
      }

      // 2) Papierdeckel (falls offen)
      if (offenDeckel > 0) {
        // pro Tag nur ein Eintrag
        const { error: dErr } = await supabase
          .from("deckel_offen")
          .upsert(
            { datum, betrag: Number(offenDeckel.toFixed(2)) },
            { onConflict: "datum", ignoreDuplicates: false }
          );
        if (dErr) throw dErr;
      }

      // 3) Kassenbuch: Barzahlung und Trinkgeld
      const inserts = [];
      if (zuZahlen > 0) {
        inserts.push({
          art: "ein",
          betrag: Number(zuZahlen.toFixed(2)),
          text: "Verkauf (Deckel)",
        });
      }
      if (trinkgeld > 0) {
        inserts.push({
          art: "trinkgeld",
          betrag: Number(trinkgeld.toFixed(2)),
          text: "Trinkgeld",
        });
      }
      if (inserts.length) {
        const { error: kErr } = await supabase.from("kassenbuch").insert(inserts);
        if (kErr) throw kErr;
      }

      // 4) UI zurücksetzen
      setKorb({});
      setGegeben("");
      setRestInput("");
      setMsg("Verbucht.");
    } catch (e) {
      setErr(e.message ?? String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Deckel</h2>

      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-[600px] w-full">
          <thead>
            <tr className="text-left">
              <th className="p-2">Artikel</th>
              <th className="p-2">EP</th>
              <th className="p-2">Anz.</th>
              <th className="p-2">GP</th>
              <th className="p-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{fmtEUR(p.preis)}</td>
                <td className="p-2">{p.menge}</td>
                <td className="p-2">{fmtEUR(p.menge * p.preis)}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => sub(p)}
                      className="px-3 py-1 rounded-xl border"
                      aria-label={`${p.name} verringern`}
                    >
                      −
                    </button>
                    <button
                      onClick={() => add(p)}
                      className="px-3 py-1 rounded-xl bg-blue-600 text-white"
                      aria-label={`${p.name} erhöhen`}
                    >
                      +
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="p-2" colSpan={3}>
                Summe
              </td>
              <td className="p-2">{fmtEUR(summe)}</td>
              <td className="p-2" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Gegeben (bar)</label>
          <input
            value={gegeben}
            onChange={(e) => setGegeben(e.target.value)}
            inputMode="decimal"
            className="w-full border rounded-xl p-2"
            placeholder="z. B. 45,00"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Rest (Papierdeckel)</label>
          <input
            value={restInput}
            onChange={(e) => setRestInput(e.target.value)}
            inputMode="decimal"
            className="w-full border rounded-xl p-2"
            placeholder="z. B. 1,50"
          />
        </div>
      </div>

      <div className="rounded-2xl border p-3 space-y-2">
        <div className="flex justify-between">
          <div>Zu zahlen</div>
          <div>{fmtEUR(zuZahlen)}</div>
        </div>
        <div className="flex justify-between">
          <div>Offen (Deckel)</div>
          <div>{fmtEUR(offenDeckel)}</div>
        </div>
        <div className="flex justify-between">
          <div>Trinkgeld</div>
          <div>{fmtEUR(trinkgeld)}</div>
        </div>
      </div>

      <button
        onClick={buchen}
        className="w-full py-3 rounded-2xl bg-green-600 text-white font-semibold"
      >
        BUCHEN
      </button>
    </div>
  );
}

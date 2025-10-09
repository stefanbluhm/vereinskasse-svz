import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Kassenbuch() {
  const [ein, setEin] = useState([]);
  const [aus, setAus] = useState([]);
  const [form, setForm] = useState({ art: "ein", betrag: "", text: "" });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("kassenbuch")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return setErr(error.message);
      const e = [], a = [];
      (data ?? []).forEach((r) => {
        if (r.art === "ein" || r.art === "trinkgeld") e.push(r);
        else a.push(r);
      });
      setEin(e);
      setAus(a);
    })();
  }, [msg]);

  async function submit() {
    setMsg(null);
    setErr(null);
    try {
      const betrag = Number(String(form.betrag).replace(",", ".")) || 0;
      if (betrag <= 0) throw new Error("Betrag fehlt.");
      const { error } = await supabase
        .from("kassenbuch")
        .insert({ art: form.art, betrag, text: form.text || null });
      if (error) throw error;
      setForm({ art: "ein", betrag: "", text: "" });
      setMsg("Gespeichert.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h2>Kassenbuch</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      {msg && <div style={{ color: "green" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 900 }}>
        <div>
          <h3>Einnahmen</h3>
          <table width="100%">
            <tbody>
              {ein.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 110 }}>
                    {new Date(r.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td>{r.text || "-"}</td>
                  <td style={{ textAlign: "right" }}>{fmtEUR(r.betrag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Ausgaben</h3>
          <table width="100%">
            <tbody>
              {aus.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 110 }}>
                    {new Date(r.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td>{r.text || "-"}</td>
                  <td style={{ textAlign: "right" }}>{fmtEUR(r.betrag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Manueller Buchungssatz</h3>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 180px 110px", gap: 8, maxWidth: 900 }}>
          <select
            value={form.art}
            onChange={(e) => setForm((f) => ({ ...f, art: e.target.value }))}
          >
            <option value="ein">Einnahme</option>
            <option value="aus">Ausgabe</option>
          </select>
          <input
            placeholder="Text"
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          />
          <input
            placeholder="Betrag z. B. 12,50"
            inputMode="decimal"
            value={form.betrag}
            onChange={(e) => setForm((f) => ({ ...f, betrag: e.target.value }))}
          />
          <button onClick={submit}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

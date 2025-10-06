import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Kassenbuch() {
  const [ein, setEin] = useState([]);
  const [aus, setAus] = useState([]);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const reload = async () => {
    setErr(null);
    const [{ data: e, error: eErr }, { data: a, error: aErr }] = await Promise.all([
      supabase.from("kassenbuch").select("*").eq("art","ein").order("created_at",{ascending:false}),
      supabase.from("kassenbuch").select("*").eq("art","aus").order("created_at",{ascending:false}),
    ]);
    if (eErr || aErr) { setErr(eErr?.message || aErr?.message); return; }
    setEin(e ?? []);
    setAus(a ?? []);
  };

  useEffect(() => { reload(); }, []);

  const sumEin = useMemo(()=> ein.reduce((s,r)=>s+Number(r.betrag||0),0), [ein]);
  const sumAus = useMemo(()=> aus.reduce((s,r)=>s+Number(r.betrag||0),0), [aus]);
  const bestand = sumEin - sumAus;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Kassenbuch</h2>
      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}
      {msg && <div style={{color:"green"}}>{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Table title="Einnahmen" rows={ein} sum={sumEin}/>
        <Table title="Ausgaben" rows={aus} sum={sumAus}/>
      </div>

      <div className="flex justify-between items-center border rounded-2xl p-3">
        <div>Bestand (aus Kassenbuch): <strong>{fmtEUR(bestand)}</strong></div>
        <div className="flex gap-2">
          <ManualForm onDone={()=>{ setMsg("Buchung gespeichert."); reload(); }}/>
          <ExportButton rows={[...ein.map(r=>({...r,art:"ein"})), ...aus.map(r=>({...r,art:"aus"}))]}/>
        </div>
      </div>
    </div>
  );
}

function Table({ title, rows, sum }) {
  return (
    <div className="border rounded-2xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 font-semibold">{title}</div>
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="p-2">Datum</th>
            <th className="p-2">Art</th>
            <th className="p-2">Text</th>
            <th className="p-2 text-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id} className="border-t">
              <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-2">{r.art}</td>
              <td className="p-2">{r.text}</td>
              <td className="p-2 text-right">{fmtEUR(r.betrag)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="p-2 font-semibold" colSpan={3}>Summe</td>
            <td className="p-2 text-right font-semibold">{fmtEUR(sum)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ManualForm({ onDone }) {
  const [art, setArt] = useState("ein");
  const [betrag, setBetrag] = useState("");
  const [text, setText] = useState("");

  async function save() {
    const n = Number(String(betrag).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    const { error } = await supabase.from("kassenbuch").insert([{ art, betrag: n, text }]);
    if (!error) { setBetrag(""); setText(""); onDone?.(); }
  }

  return (
    <div className="flex gap-2">
      <select value={art} onChange={(e)=>setArt(e.target.value)} className="border rounded-xl p-2">
        <option value="ein">Einnahme</option>
        <option value="aus">Ausgabe</option>
      </select>
      <input value={betrag} onChange={(e)=>setBetrag(e.target.value)} placeholder="Betrag"
             className="border rounded-xl p-2 w-28" inputMode="decimal"/>
      <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Text"
             className="border rounded-xl p-2 w-48"/>
      <button onClick={save} className="px-3 rounded-2xl bg-blue-600 text-white">Buchen</button>
    </div>
  );
}

function ExportButton({ rows }) {
  function toCSV() {
    const head = ["created_at","art","text","betrag"];
    const body = rows.map(r => [r.created_at, r.art, r.text, String(r.betrag).replace(".", ",")]);
    const csv = [head, ...body].map(a=>a.map(x=>`"${(x??"").toString().replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kassenbuch-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }
  return <button onClick={toCSV} className="px-3 rounded-2xl bg-gray-100">Export CSV</button>;
}

import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Kassenbuch() {
  const [entries, setEntries] = useState([]);
  const [art, setArt] = useState("ein");
  const [betrag, setBetrag] = useState("");
  const [text, setText] = useState("");

  async function load() {
    const { data } = await supabase
      .from("kassenbuch")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addEntry() {
    const val = Number(String(betrag).replace(",", "."));
    if (!val) return alert("Bitte Betrag eingeben.");
    const { error } = await supabase
      .from("kassenbuch")
      .insert([{ art, betrag: val, text: text || (art==="ein"?"Einnahme":"Ausgabe") }]);
    if (!error) {
      setBetrag(""); setText("");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Kassenbuch</h2>
      <div className="rounded-2xl border divide-y">
        {entries.length===0 && <div className="p-3 text-sm text-gray-500">Noch keine Einträge.</div>}
        {entries.map(e=>(
          <div key={e.id} className="flex justify-between p-3">
            <div>
              <div className={`font-medium ${e.art==="ein"?"text-green-700": e.art==="trinkgeld"?"text-amber-700":"text-red-700"}`}>
                {e.art}
              </div>
              <div className="text-sm text-gray-600">{e.text}</div>
              <div className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</div>
            </div>
            <div className="font-semibold">{fmtEUR(e.betrag)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-3 space-y-2">
        <h3 className="font-semibold">Neue Buchung</h3>
        <div className="grid grid-cols-2 gap-2">
          <select value={art} onChange={e=>setArt(e.target.value)} className="border rounded-xl p-2">
            <option value="ein">Einnahme</option>
            <option value="aus">Ausgabe</option>
            <option value="trinkgeld">Trinkgeld</option>
          </select>
          <input value={betrag} onChange={e=>setBetrag(e.target.value)} inputMode="decimal" placeholder="Betrag" className="border rounded-xl p-2"/>
        </div>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Belegtext" className="border rounded-xl p-2 w-full"/>
        <button onClick={addEntry} className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold">Speichern</button>
      </div>
    </div>
  );
}

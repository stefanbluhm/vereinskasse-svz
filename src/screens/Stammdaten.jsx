import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Stammdaten() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [preis, setPreis] = useState("");

  async function load() {
    const { data } = await supabase.from("produkte").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addProdukt() {
    const p = Number(String(preis).replace(",", "."));
    if (!name || !p) return alert("Bitte Name und Preis angeben.");
    const { error } = await supabase.from("produkte").insert([{ name, preis: p, aktiv: true }]);
    if (!error) { setName(""); setPreis(""); load(); }
  }

  async function toggleAktiv(id, aktiv) {
    const { error } = await supabase.from("produkte").update({ aktiv: !aktiv }).eq("id", id);
    if (!error) load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Stammdaten</h2>

      <div className="rounded-2xl border">
        {items.map(p=>(
          <div key={p.id} className="p-2 border-b last:border-b-0 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-500">{fmtEUR(p.preis)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${p.aktiv?"bg-green-100 text-green-700":"bg-gray-200 text-gray-700"}`}>{p.aktiv?"aktiv":"inaktiv"}</span>
              <button onClick={()=>toggleAktiv(p.id, p.aktiv)} className="px-3 py-1 rounded-xl bg-gray-100">Toggle</button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-3 space-y-2">
        <h3 className="font-semibold">Neues Produkt</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Artikelname" className="border rounded-xl p-2 w-full"/>
        <input value={preis} onChange={e=>setPreis(e.target.value)} inputMode="decimal" placeholder="Preis (z.B. 2,50)" className="border rounded-xl p-2 w-full"/>
        <button onClick={addProdukt} className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold">Hinzufügen</button>
      </div>
    </div>
  );
}

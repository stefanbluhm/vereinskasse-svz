import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Stammdaten() {
  const [produkte, setProdukte] = useState([]);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("produkte")
      .select("*")
      .order("name", { ascending: true });
    if (error) setErr(error.message);
    else setProdukte(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function toggleAktiv(p) {
    setErr(null); setInfo(null);
    const { error } = await supabase
      .from("produkte")
      .update({ aktiv: !p.aktiv })
      .eq("id", p.id);
    if (error) setErr(error.message);
    else { setInfo("Gespeichert."); load(); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Stammdaten</h2>
      {err && <div className="text-sm text-red-600">Fehler: {err}</div>}
      {info && <div className="text-sm text-green-600">{info}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {produkte.map(p=>(
          <div key={p.id} className="rounded-2xl border p-4 flex flex-col gap-2">
            <div className="text-base font-medium">{p.name}</div>
            <div className="text-sm text-gray-500">Preis</div>
            <div className="text-lg">{fmtEUR(p.preis)}</div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-gray-500">Aktiv</div>
              <button
                onClick={()=>toggleAktiv(p)}
                className={`px-3 py-1 rounded-xl ${p.aktiv ? "bg-green-600 text-white" : "bg-gray-200"}`}
              >
                {p.aktiv ? "Ja" : "Nein"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

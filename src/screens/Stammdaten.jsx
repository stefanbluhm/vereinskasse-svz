import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Stammdaten() {
  const [produkte, setProdukte] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    supabase.from("produkte").select("*").order("name", { ascending: true })
      .then(({data, error}) => error ? setErr(error.message) : setProdukte(data ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Stammdaten</h2>
      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(produkte ?? []).map(p => (
          <div key={p.id} className="rounded-2xl border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-gray-500 mb-2">Preis: {fmtEUR(p.preis)}</div>
            <span className={`px-2 py-1 rounded-xl text-xs ${p.aktiv ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
              {p.aktiv ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

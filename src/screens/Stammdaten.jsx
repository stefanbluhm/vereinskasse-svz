import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Stammdaten() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(()=> {
    (async () => {
      const { data, error } = await supabase.from("produkte").select("*").order("name",{ascending:true});
      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Stammdaten</h2>
      {err && <div style={{color:"crimson"}}>Fehler: {err}</div>}

      <table className="w-full border rounded-2xl overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right">Preis</th>
            <th className="p-2 text-center">Aktiv</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.name}</td>
              <td className="p-2 text-right">{fmtEUR(r.preis)}</td>
              <td className="p-2 text-center">{r.aktiv ? "Ja" : "Nein"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

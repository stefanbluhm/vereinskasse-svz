import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";

export default function Stammdaten() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("produkte")
        .select("*")
        .order("name");
      if (error) setErr(error.message);
      setList(data ?? []);
    })();
  }, []);

  return (
    <div>
      <h2>Stammdaten</h2>
      {err && <div style={{ color: "crimson" }}>Fehler: {err}</div>}
      <table style={{ width: "100%", maxWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Name</th>
            <th>Preis</th>
            <th>Aktiv</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{fmtEUR(p.preis)}</td>
              <td style={{ textAlign: "center" }}>{p.aktiv ? "Ja" : "Nein"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

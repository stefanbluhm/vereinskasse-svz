import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtEUR } from "../lib/currency";
import { todayKey } from "../lib/dates";

export default function Tagesuebersicht() {
  const dkey = todayKey();
  const [artikel, setArtikel] = useState([]);
  const [kassenbuch, setKassenbuch] = useState([]);
  const [counts, setCounts] = useState({});
  const [notiz, setNotiz] = useState("");
  const [saved, setSaved] = useState(null);
  const DENOMS = [200,100,50,20,10,5,2,1,0.5,0.2,0.1,0.05];

  useEffect(() => {
    (async () => {
      const { data: ta } = await supabase
        .from("tagesartikel")
        .select("*, produkte(name)")
        .eq("datum", dkey)
        .order("produkt_id");
      setArtikel(ta ?? []);

      const { data: kb } = await supabase
        .from("kassenbuch")
        .select("*")
        .gte("created_at", `${dkey}T00:00:00`)
        .lt("created_at", `${dkey}T23:59:59`)
        .order("created_at", { ascending: false });
      setKassenbuch(kb ?? []);

      const { data: z } = await supabase
        .from("zaehlung")
        .select("*")
        .eq("datum", dkey)
        .maybeSingle();
      if (z) { setCounts(z.counts||{}); setNotiz(z.notiz||""); setSaved(z); }
    })();
  }, [dkey]);

  const sumGez = useMemo(() => {
    const cents = DENOMS.reduce((acc,d)=> acc + (Number(counts[d]||0) * Math.round(d*100)), 0);
    return cents/100;
  }, [counts]);

  const gesamtUmsatz = (artikel||[]).reduce((a,b)=>a + Number(b.umsatz||0),0);
  const barEinnahmen = (kassenbuch||[])
    .filter(e=> e.art==="ein")
    .reduce((a,b)=> a + Number(b.betrag||0), 0);
  const trinkgeld = (kassenbuch||[])
    .filter(e=> e.art==="trinkgeld")
    .reduce((a,b)=> a + Number(b.betrag||0), 0);

  const inc = (d)=> setCounts(c=> ({...c, [d]: (c[d]||0)+1}));
  const dec = (d)=> setCounts(c=> ({...c, [d]: Math.max(0,(c[d]||0)-1)}));
  const setQty=(d,v)=> setCounts(c=> ({...c, [d]: Math.max(0, Number(v||0))}));

  async function speichernZaehlung() {
    const payload = { datum: dkey, counts, summe: sumGez, notiz };
    if (saved) {
      const { error } = await supabase.from("zaehlung").update(payload).eq("id", saved.id);
      if (!error) setSaved({...saved, ...payload});
    } else {
      const { data, error } = await supabase.from("zaehlung").insert([payload]).select().single();
      if (!error) setSaved(data);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tagesübersicht ({dkey})</h2>

      <div className="rounded-2xl border divide-y">
        {(artikel||[]).length===0 && <div className="p-3 text-sm text-gray-500">Noch keine Buchungen.</div>}
        {(artikel||[]).map(z=>(
          <div key={z.id} className="flex justify-between p-3">
            <div>{z.produkte?.name || z.produkt_id}</div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Anzahl: {z.anzahl}</div>
              <div className="font-medium">{fmtEUR(z.umsatz)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-3 space-y-1">
        <div className="flex justify-between"><div>Gesamtumsatz</div><div>{fmtEUR(gesamtUmsatz)}</div></div>
        <div className="flex justify-between"><div>Davon bar</div><div>{fmtEUR(barEinnahmen)}</div></div>
        <div className="flex justify-between"><div>Trinkgeld</div><div>{fmtEUR(trinkgeld)}</div></div>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h3 className="font-semibold">Kassenbestand zählen</h3>
        {saved && <div className="text-xs text-gray-500">Zuletzt gespeichert – {fmtEUR(saved.summe)}</div>}

        <div className="grid grid-cols-2 gap-2">
          {DENOMS.map(d=>(
            <div key={d} className="flex items-center justify-between border rounded-xl p-2">
              <div className="text-sm">{d>=5 ? fmtEUR(d) : `${d.toFixed(2)} €`}</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>dec(d)} className="px-2 py-1 rounded-lg bg-gray-100">−</button>
                <input inputMode="numeric" value={counts[d]||""} onChange={e=>setQty(d, e.target.value)} className="w-14 text-center border rounded-lg p-1"/>
                <button onClick={()=>inc(d)} className="px-2 py-1 rounded-lg bg-gray-100">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <div className="font-medium">Summe gezählt</div>
          <div className="font-semibold">{fmtEUR(sumGez)}</div>
        </div>

        <input value={notiz} onChange={e=>setNotiz(e.target.value)} placeholder="Notiz (optional)" className="w-full border rounded-xl p-2"/>
        <button onClick={speichernZaehlung} className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold">Speichern</button>
      </div>
    </div>
  );
}

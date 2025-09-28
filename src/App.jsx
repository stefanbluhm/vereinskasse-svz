import { useState } from "react";
import Deckel from "./screens/Deckel";
import Tagesuebersicht from "./screens/Tagesuebersicht";
import Kassenbuch from "./screens/Kassenbuch";
import Stammdaten from "./screens/Stammdaten";

export default function App() {
  const [tab, setTab] = useState(1); // 1=Deckel, 2=Tagesübersicht, 3=Kassenbuch, 4=Stammdaten
  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 max-w-md mx-auto">
      <header className="mb-3">
        <h1 className="text-2xl font-bold">Vereinskasse</h1>
        <p className="text-sm text-gray-500">Supabase-Prototype</p>
      </header>

      <nav className="grid grid-cols-4 gap-2 mb-4">
        <button onClick={() => setTab(1)} className={`px-2 py-2 rounded-2xl shadow ${tab===1?"bg-blue-600 text-white":"bg-gray-100"}`}>Deckel</button>
        <button onClick={() => setTab(2)} className={`px-2 py-2 rounded-2xl shadow ${tab===2?"bg-blue-600 text-white":"bg-gray-100"}`}>Tagesübersicht</button>
        <button onClick={() => setTab(3)} className={`px-2 py-2 rounded-2xl shadow ${tab===3?"bg-blue-600 text-white":"bg-gray-100"}`}>Kassenbuch</button>
        <button onClick={() => setTab(4)} className={`px-2 py-2 rounded-2xl shadow ${tab===4?"bg-blue-600 text-white":"bg-gray-100"}`}>Stammdaten</button>
      </nav>

      {tab===1 && <Deckel/>}
      {tab===2 && <Tagesuebersicht/>}
      {tab===3 && <Kassenbuch/>}
      {tab===4 && <Stammdaten/>}
    </div>
  );
}

import { useState } from "react";

import "./App.css";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import LeadModal from "./components/LeadModal";

import useLeads from "./hooks/useLeads";

export default function App() {

  const { leads } = useLeads();

  const [modalAberto, setModalAberto] = useState(false);

  return (
    <div className="layout">

      <Sidebar />

      <main className="conteudo">

        <Header
          abrirModal={() => setModalAberto(true)}
        />

        <Dashboard leads={leads} />

      </main>

      <LeadModal
        aberto={modalAberto}
        fechar={() => setModalAberto(false)}
      />

    </div>
  );
}
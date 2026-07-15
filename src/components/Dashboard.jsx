import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useState } from "react";

import "../styles/dashboard.css";

import NotificationCenter from "./NotificationCenter/NotificationCenter";
import LeadDetailsModal from "./LeadDetailsModal/LeadDetailsModal";
import LeadBoard from "./Lead/LeadBoard";
import FiltersBar from "./Filters/FiltersBar";

import { filtrarLeads } from "../utils/leadFilters";

export default function Dashboard({ leads }) {

  const [leadDetalhes, setLeadDetalhes] = useState(null);

  const [filtros, setFiltros] = useState({
    pesquisa: "",
    consultora: "Todas",
    origem: "Todas",
    status: "Todos",
    objetivo: "Todos",
  });

  async function assumirLead(id) {
    await updateDoc(doc(db, "leads", id), {
      status: "Em Atendimento",
      assumidoEm: serverTimestamp(),
    });
  }

  // CONTADORES

  const novos = leads.filter(
    (lead) => lead.status === "Novo Lead"
  ).length;

  const atendimento = leads.filter(
    (lead) => lead.status === "Em Atendimento"
  ).length;

  const confirmados = leads.filter(
    (lead) => lead.status === "Confirmado"
  ).length;

  // ORDEM DOS STATUS

  const ordemStatus = {
    "Novo Lead": 0,
    "Em Atendimento": 1,
    "Confirmado": 2,
  };

  // ORDENAÇÃO

  const leadsOrdenados = [...leads].sort((a, b) => {

    const status = ordemStatus[a.status] - ordemStatus[b.status];

    if (status !== 0) return status;

    const dataA = a.createdAt?.seconds || 0;
    const dataB = b.createdAt?.seconds || 0;

    return dataB - dataA;

  });

  // LISTAS DOS FILTROS

  const consultoras = [
    ...new Set(
      leads
        .map((lead) => lead.consultora)
        .filter(Boolean)
    ),
  ].sort();

  const origens = [
    ...new Set(
      leads
        .map((lead) => lead.origem)
        .filter(Boolean)
    ),
  ].sort();

  const objetivos = [
    ...new Set(
      leads
        .map((lead) => lead.objetivo)
        .filter(Boolean)
    ),
  ].sort();

  const status = [
    ...new Set(
      leads
        .map((lead) => lead.status)
        .filter(Boolean)
    ),
  ].sort();

  // FILTROS

  const leadsFiltrados = filtrarLeads(
    leadsOrdenados,
    filtros
  );

  return (
    <>

      <LeadDetailsModal
        lead={leadDetalhes}
        setLead={setLeadDetalhes}
        onClose={() => setLeadDetalhes(null)}
      />

      <NotificationCenter leads={leads} />

      <section className="dashboard">

        <div className="cardDashboard">
          <h3>Leads Hoje</h3>
          <span className="numero">{leads.length}</span>
        </div>

        <div className="cardDashboard">
          <h3>Novos Leads</h3>
          <span className="numero">{novos}</span>
        </div>

        <div className="cardDashboard">
          <h3>Em Atendimento</h3>
          <span className="numero">{atendimento}</span>
        </div>

        <div className="cardDashboard">
          <h3>Confirmados</h3>
          <span className="numero">{confirmados}</span>
        </div>

      </section>

      <FiltersBar
        filtros={filtros}
        setFiltros={setFiltros}
        consultoras={consultoras}
        origens={origens}
        objetivos={objetivos}
        status={status}
      />

      <LeadBoard
        leads={leadsFiltrados}
        onAssumir={assumirLead}
        onVerHistorico={setLeadDetalhes}
      />

    </>
  );

}
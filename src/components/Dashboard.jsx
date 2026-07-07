import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";

import "../styles/dashboard.css";

import NotificationCenter from "./NotificationCenter/NotificationCenter";

export default function Dashboard({ leads }) {
  async function assumirLead(id) {
    await updateDoc(doc(db, "leads", id), {
      status: "Em Atendimento",
    });
  }

  const novos = leads.filter(
    (lead) => lead.status === "Novo Lead"
  ).length;

  const atendimento = leads.filter(
    (lead) => lead.status === "Em Atendimento"
  ).length;

  const confirmados = leads.filter(
    (lead) => lead.status === "Confirmado"
  ).length;

  return (
    <>
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

      <section className="listaLeads">

        {leads.map((lead) => (

          <div
            key={lead.id}
            className={
              lead.status === "Novo Lead"
                ? "leadCard novoLead"
                : "leadCard"
            }
          >

            <h2>{lead.nome}</h2>

            <p>📞 {lead.telefone}</p>

            <p>🎂 {lead.idade} anos</p>

            <p>🎯 {lead.objetivo}</p>

            <p>📍 {lead.origem}</p>

            <div className="status">
              {lead.status}
            </div>

            <div className="acoes">

              {lead.status === "Novo Lead" ? (

                <button
                  className="btnAzul"
                  onClick={() => assumirLead(lead.id)}
                >
                  Assumir Lead
                </button>

              ) : (

                <button
                  className="btnAzul"
                  disabled
                >
                  Em Atendimento
                </button>

              )}

              <a
                href={`https://wa.me/55${lead.telefone}`}
                target="_blank"
                rel="noreferrer"
              >
                <button className="btnVerde">
                  WhatsApp
                </button>
              </a>

            </div>

          </div>

        ))}

      </section>

    </>
  );
}
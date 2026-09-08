import { useState } from "react";

import "./consultaLead.css";

import useConsultaLeads from "../hooks/useConsultaLeads";

import LeadActionModal from "./LeadDetailsModal/LeadActionModal";
import LeadDetailsModal from "./LeadDetailsModal/LeadDetailsModal";


// ==========================================================
// CONSULTA DE LEAD (ENTRE RECEPCIONISTAS)
// ==========================================================
//
// Busca sob demanda (useConsultaLeads — hook próprio, não
// useLeads()) por nome ou telefone, em QUALQUER lead. Ao
// escolher um resultado, abre o mesmo LeadDetailsModal.jsx já
// usado pelo Kanban — o "modo consulta" (somente leitura para
// quem não é dona do lead) é decidido lá dentro, então este
// componente não precisa saber nada sobre permissões.
// ==========================================================

export default function ConsultaLeadModal({
  aberto,
  fechar,
}) {

  const {
    resultados,
    carregando,
    consultar,
    limpar,
  } = useConsultaLeads();


  const [termo, setTermo] =
    useState("");

  const [leadSelecionado, setLeadSelecionado] =
    useState(null);


  function buscar() {

    consultar(termo);

  }


  function fecharTudo() {

    setTermo("");

    limpar();

    setLeadSelecionado(null);

    fechar();

  }


  if (!aberto) {
    return null;
  }


  return (

    <>

      <LeadActionModal
        aberto={aberto && !leadSelecionado}
        titulo="🔍 Consultar Lead"
      >

        <p>
          Busque por nome ou telefone para consultar um lead —
          inclusive de outra recepcionista. A consulta é
          somente leitura.
        </p>

        <div className="consultaLeadBusca">

          <input
            type="text"
            placeholder="Nome ou telefone..."
            value={termo}
            onChange={(e) =>
              setTermo(e.target.value)
            }
            onKeyDown={(e) => {

              if (e.key === "Enter") {
                buscar();
              }

            }}
          />

          <button
            type="button"
            className="btnSalvar"
            onClick={buscar}
            disabled={carregando || !termo.trim()}
          >
            {carregando ? "Buscando..." : "Buscar"}
          </button>

        </div>


        {carregando && (

          <p className="consultaLeadVazio">
            Buscando leads...
          </p>

        )}


        {!carregando &&
          termo.trim() &&
          resultados.length === 0 && (

          <p className="consultaLeadVazio">
            Nenhum lead encontrado para "{termo}".
          </p>

        )}


        {resultados.length > 0 && (

          <ul className="consultaLeadLista">

            {resultados.map((lead) => (

              <li key={lead.id}>

                <button
                  type="button"
                  className="consultaLeadItem"
                  onClick={() =>
                    setLeadSelecionado(lead)
                  }
                >

                  <strong>
                    {lead.nome || "Sem nome"}
                  </strong>

                  <span>
                    📞 {lead.telefone || "Não informado"}
                  </span>

                  <span>
                    👤 {lead.responsavel ||
                      lead.consultora ||
                      "Sem responsável"}
                  </span>

                </button>

              </li>

            ))}

          </ul>

        )}


        <div className="leadActionButtons">

          <button
            type="button"
            className="btnCancelar"
            onClick={fecharTudo}
          >
            Fechar
          </button>

        </div>

      </LeadActionModal>


      {leadSelecionado && (

        <LeadDetailsModal
          lead={leadSelecionado}
          onClose={fecharTudo}
        />

      )}

    </>

  );

}

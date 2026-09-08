import { useState } from "react";

import WhatsAppLivreModal from "../WhatsAppLivreModal";

import EditarLeadAction from "./actions/EditarLeadAction";

export default function LeadHeader({
  lead,
  setLead,
  onClose,
  podeAgir = true,
}) {

  const [whatsappAberto, setWhatsappAberto] =
    useState(false);

  return (

    <div className="leadHeader">

      <div>

        <h2>{lead.nome}</h2>

        <div className="leadHeaderInfo">

          <span>📞 {lead.telefone}</span>

          <span>🎯 {lead.objetivo}</span>

          <span>📍 {lead.origem}</span>

        </div>

        {lead.telefone && podeAgir && (

          <button
            type="button"
            className="leadHeaderWhatsApp"
            onClick={() =>
              setWhatsappAberto(true)
            }
          >
            💬 WhatsApp
          </button>

        )}

        {podeAgir && (

          <EditarLeadAction
            lead={lead}
            setLead={setLead}
          />

        )}

      </div>

      <button
        className="closeButton"
        onClick={onClose}
      >
        ✕
      </button>

      <WhatsAppLivreModal

        aberto={whatsappAberto}

        fechar={() =>
          setWhatsappAberto(false)
        }

        leadId={lead.id}

        nome={lead.nome}

        telefone={lead.telefone}

      />

    </div>

  );

}

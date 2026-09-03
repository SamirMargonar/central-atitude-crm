import { construirLinkWhatsApp } from "../../utils/whatsapp";

import EditarLeadAction from "./actions/EditarLeadAction";

export default function LeadHeader({
  lead,
  setLead,
  onClose,
}) {

  return (

    <div className="leadHeader">

      <div>

        <h2>{lead.nome}</h2>

        <div className="leadHeaderInfo">

          <span>📞 {lead.telefone}</span>

          <span>🎯 {lead.objetivo}</span>

          <span>📍 {lead.origem}</span>

        </div>

        {lead.telefone && (

          <a
            className="leadHeaderWhatsApp"
            href={construirLinkWhatsApp(
              lead.telefone,
              `Olá ${lead.nome}!`
            )}
            target="_blank"
            rel="noreferrer"
          >
            💬 WhatsApp
          </a>

        )}

        <EditarLeadAction
          lead={lead}
          setLead={setLead}
        />

      </div>

      <button
        className="closeButton"
        onClick={onClose}
      >
        ✕
      </button>

    </div>

  );

}

import "../styles/leads.css";

import {
  nomeDaEtapa,
} from "../../core/LeadFlow.js";


// ==========================================================
// CARD DE LEAD — MOBILE
// ==========================================================
//
// Componente próprio do Mobile — não importa LeadCard.jsx nem
// nenhum CSS do Desktop. Mostra só os campos já existentes no
// documento do lead (nada inventado): nome, telefone, objetivo,
// origem, etapa (nomeDaEtapa, de core/LeadFlow.js) e o estado
// assumido/aguardando (lead.assumido, mesmo campo que o Desktop
// já usa em toda parte).
// ==========================================================

export default function LeadCardMobile({
  lead,
  onClick,
}) {

  const etapa =
    Number(
      lead?.etapa ?? 0
    );


  const aguardando =
    !lead?.assumido;


  return (

    <button
      type="button"
      className="mobileLeadCard"
      onClick={onClick}
    >

      <div className="mobileLeadCardTopo">

        <strong className="mobileLeadCardNome">
          {lead?.nome || "Lead"}
        </strong>

        <span
          className={`
            mobileLeadCardStatus
            ${
              aguardando
                ? "mobileLeadCardStatusAguardando"
                : "mobileLeadCardStatusAssumido"
            }
          `}
        >

          {aguardando
            ? "🆕 Aguardando"
            : "🤝 Em atendimento"}

        </span>

      </div>


      <div className="mobileLeadCardInfo">

        <span>
          📞{" "}
          {lead?.telefone ||
            "Não informado"}
        </span>

        {lead?.objetivo && (

          <span>
            🎯{" "}
            {lead.objetivo}
          </span>

        )}

        {lead?.origem && (

          <span>
            📍{" "}
            {lead.origem}
          </span>

        )}

      </div>


      <div className="mobileLeadCardRodape">

        <span className="mobileLeadCardEtapa">
          {nomeDaEtapa(etapa)}
        </span>

      </div>

    </button>

  );

}

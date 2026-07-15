import LeadCard from "./LeadCard";
import "../../styles/LeadBoard.css";

export default function LeadBoard({
  leads,
  onAssumir,
  onVerHistorico,
}) {

  const novos = leads.filter(
    (lead) => lead.status === "Novo Lead"
  );

  const atendimento = leads.filter(
    (lead) => lead.status === "Em Atendimento"
  );

  const confirmados = leads.filter(
    (lead) => lead.status === "Confirmado"
  );

  return (

    <section className="leadBoard">

      <div className="leadColumn">

        <div className="leadColumnHeader">
          🟢 Novos Leads ({novos.length})
        </div>

        {novos.map((lead) => (

          <LeadCard
            key={lead.id}
            lead={lead}
            onAssumir={onAssumir}
            onVerHistorico={onVerHistorico}
          />

        ))}

      </div>

      <div className="leadColumn">

        <div className="leadColumnHeader">
          🟡 Em Atendimento ({atendimento.length})
        </div>

        {atendimento.map((lead) => (

          <LeadCard
            key={lead.id}
            lead={lead}
            onAssumir={onAssumir}
            onVerHistorico={onVerHistorico}
          />

        ))}

      </div>

      <div className="leadColumn">

        <div className="leadColumnHeader">
          🔵 Confirmados ({confirmados.length})
        </div>

        {confirmados.map((lead) => (

          <LeadCard
            key={lead.id}
            lead={lead}
            onAssumir={onAssumir}
            onVerHistorico={onVerHistorico}
          />

        ))}

      </div>

    </section>

  );

}
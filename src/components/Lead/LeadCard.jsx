import LeadTimer from "./LeadTimer";

export default function LeadCard({
  lead,
  onAssumir,
  onVerHistorico,
}) {
  return (
    <div
      className={
        lead.status === "Novo Lead"
          ? "leadCard novoLead"
          : "leadCard"
      }
    >
      <h2>{lead.nome}</h2>

      <LeadTimer createdAt={lead.createdAt} />

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
            onClick={() => onAssumir(lead.id)}
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

        <button
          className="btnHistorico"
          onClick={() => onVerHistorico(lead)}
        >
          Ver Histórico
        </button>

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
  );
}
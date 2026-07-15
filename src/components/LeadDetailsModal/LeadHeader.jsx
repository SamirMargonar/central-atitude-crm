export default function LeadHeader({
  lead,
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
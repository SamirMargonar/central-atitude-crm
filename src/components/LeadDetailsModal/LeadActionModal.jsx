import "./LeadDetailsModal.css";

export default function LeadActionModal({
  aberto,
  titulo,
  children,
}) {

  if (!aberto) return null;

  return (

    <div className="modalOverlay">

      <div className="leadActionModal">

        <div className="leadActionHeader">

          <h2>{titulo}</h2>

        </div>

        <div className="leadActionBody">

          {children}

        </div>

      </div>

    </div>

  );

}
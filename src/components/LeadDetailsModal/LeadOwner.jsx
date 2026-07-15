import "./LeadDetailsModal.css";

export default function LeadOwner({ lead }) {

  return (

    <section className="leadOwner">

      <div className="ownerCard">

        <span className="ownerLabel">
          👤 Responsável Comercial
        </span>

        <h3>
          {lead?.responsavel || "Não definido"}
        </h3>

      </div>

      <div className="ownerCard">

        <span className="ownerLabel">
          🕒 Último Atendimento
        </span>

        <h3>
          {lead?.ultimoAtendimento || "Nenhum atendimento"}
        </h3>

      </div>

    </section>

  );

}
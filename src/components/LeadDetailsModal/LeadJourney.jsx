import "./LeadDetailsModal.css";

import { JORNADA } from "../../core/LeadFlow";

export default function LeadJourney({ lead }) {

  const etapaAtual = lead?.etapa ?? 0;

  return (

    <section className="leadJourney">

      <h3>📊 Jornada do Cliente</h3>

      <div className="journeySteps">

        {JORNADA.map((etapa) => (

          <div
            key={etapa.id}
            className="journeyItem"
          >

            <div
              className={
                etapa.id <= etapaAtual
                  ? "journeyCircle active"
                  : "journeyCircle"
              }
            >

              {etapa.id + 1}

            </div>

            <span>

              {etapa.nome}

            </span>

          </div>

        ))}

      </div>

    </section>

  );

}
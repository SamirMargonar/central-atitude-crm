import "./LeadDetailsModal.css";

import {
  JORNADA,
} from "../../core/LeadFlow";


export default function LeadJourney({
  lead,
}) {

  const etapaAtual =
    Number(
      lead?.etapa ?? 0
    );


  return (

    <section className="leadJourney">

      <h3>
        📊 Jornada do Cliente
      </h3>


      <div className="journeySteps">

        {JORNADA.map(
          (etapa) => {

            const concluida =
              etapa.id < etapaAtual;


            const atual =
              etapa.id === etapaAtual;


            return (

              <div
                key={etapa.id}
                className={`journeyItem ${
                  atual
                    ? "current"
                    : ""
                } ${
                  concluida
                    ? "completed"
                    : ""
                }`}
              >

                <div
                  className={`journeyCircle ${
                    concluida ||
                    atual
                      ? "active"
                      : ""
                  }`}
                >

                  {concluida
                    ? "✓"
                    : etapa.id + 1}

                </div>


                <span>

                  {etapa.nome}

                </span>


                {atual && (

                  <small>
                    Em andamento
                  </small>

                )}

              </div>

            );

          }
        )}

      </div>

    </section>

  );

}
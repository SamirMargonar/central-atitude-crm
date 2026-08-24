import { useEffect, useState } from "react";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

import "./LeadDetailsModal.css";

export default function LeadTimeline({ lead }) {

  const [historico, setHistorico] =
    useState([]);


  useEffect(() => {

    if (!lead?.id) {

      setHistorico([]);

      return;

    }


    const q = query(

      collection(
        db,
        "leads",
        lead.id,
        "eventos"
      ),

      orderBy(
        "criadoEm",
        "desc"
      )

    );


    const unsubscribe =
      onSnapshot(

        q,

        (snapshot) => {

          const lista =
            snapshot.docs.map(
              (doc) => ({

                id: doc.id,

                ...doc.data(),

              })
            );


          setHistorico(lista);

        },

        (erro) => {

          console.error(
            "Erro ao carregar timeline do Lead:",
            erro
          );

          setHistorico([]);

        }

      );


    return () =>
      unsubscribe();

  }, [lead?.id]);


  function formatarData(timestamp) {

    if (!timestamp?.toDate) {

      return "";

    }


    return timestamp
      .toDate()
      .toLocaleString(
        "pt-BR",
        {

          day: "2-digit",

          month: "2-digit",

          year: "numeric",

          hour: "2-digit",

          minute: "2-digit",

        }
      );

  }


  function tituloEvento(evento) {

    switch (evento.tipo) {


      case "WHATSAPP":

        return "📞 Primeiro Contato";


      case "RESPOSTA_LEAD":

        return "💬 Resposta do Lead";


      case "VISITA":

        if (
          evento.dados?.visitaAnterior
        ) {

          return "🔄 Visita Reagendada";

        }


        if (
          evento.descricao
            ?.toLowerCase()
            .includes("compareceu")
        ) {

          return "🏋 Cliente Compareceu";

        }


        return "📅 Visita Agendada";


      case "COMPARECIMENTO":

        return "🏋 Cliente Compareceu";


      case "NEGOCIACAO":

        return "💰 Negociação";


      case "MATRICULA":

        return "🎓 Matrícula";


      case "JORNADA":

        return "🔄 Avanço na Jornada";


      case "OBSERVACAO":

        return "📝 Observação";


      case "RENOVACAO_CONTATO":

        return "📱 Contato de Renovação";


      case "RENOVACAO_RESPOSTA":

        return evento.dados?.resposta === "POSITIVA"
          ? "🟢 Resposta da Renovação"
          : "🔴 Resposta da Renovação";


      case "RENOVACAO_CONFIRMADA":

        return "🔄 Renovação Confirmada";


      case "RENOVACAO_RECUSADA":

        return "❌ Não Renovação";


      default:

        return "📌 Evento";

    }

  }


  // ==========================================================
  // RESPONSÁVEL COMERCIAL
  // ==========================================================
  //
  // A Timeline deve mostrar o responsável pelo Lead,
  // e não necessariamente o usuário que estava logado
  // quando o evento foi registrado.
  //
  // Exemplo:
  //
  // lead.consultora = "Naykison"
  //
  // Timeline:
  // 👤 Naykison
  //
  // ==========================================================

  const nomeResponsavel =
    lead?.consultora ||
    lead?.responsavel ||
    lead?.responsavelComercial ||
    "Responsável não informado";


  return (

    <section className="leadTimeline">

      <h3>
        📜 Timeline Comercial
      </h3>


      {historico.length === 0 ? (

        <p className="timelineEmpty">

          Nenhum evento registrado.

        </p>

      ) : (

        historico.map(
          (evento) => (

            <div
              key={evento.id}
              className="timelineItem"
            >

              <div
                className="timelineHeader"
              >

                <strong>

                  {tituloEvento(
                    evento
                  )}

                </strong>


                <span>

                  {formatarData(
                    evento.criadoEm
                  )}

                </span>

              </div>


              <p>

                {evento.descricao}

              </p>


              {/* =================================
                  VISITA
              ================================= */}

              {evento.dados?.data && (

                <p>

                  📅{" "}
                  <strong>
                    Data:
                  </strong>{" "}

                  {evento.dados.data}

                </p>

              )}


              {evento.dados?.hora && (

                <p>

                  🕒{" "}
                  <strong>
                    Horário:
                  </strong>{" "}

                  {evento.dados.hora}

                </p>

              )}


              {evento.dados?.consultor && (

                <p>

                  👤{" "}
                  <strong>
                    Consultor:
                  </strong>{" "}

                  {evento.dados.consultor}

                </p>

              )}


              {evento.dados?.observacao && (

                <p>

                  📝{" "}
                  <strong>
                    Observação:
                  </strong>{" "}

                  {evento.dados.observacao}

                </p>

              )}


              {/* =================================
                  REAGENDAMENTO
              ================================= */}

              {evento.dados
                ?.visitaAnterior && (

                <div>

                  <p>

                    🔙{" "}
                    <strong>
                      Visita anterior:
                    </strong>{" "}

                    {
                      evento.dados
                        .visitaAnterior
                        .data
                    }

                    {" às "}

                    {
                      evento.dados
                        .visitaAnterior
                        .hora
                    }

                  </p>


                  <p>

                    🔄{" "}
                    <strong>
                      Nova visita:
                    </strong>{" "}

                    {
                      evento.dados
                        .novaVisita
                        ?.data
                    }

                    {" às "}

                    {
                      evento.dados
                        .novaVisita
                        ?.hora
                    }

                  </p>

                </div>

              )}


              {/* =================================
                  AVANÇO DE JORNADA
              ================================= */}

              {evento.tipo ===
                "JORNADA" &&
                evento.dados
                  ?.etapaAnterior !==
                  undefined && (

                <p>

                  🔄{" "}
                  <strong>
                    Etapa:
                  </strong>{" "}

                  {
                    evento.dados
                      .etapaAnterior
                  }

                  {" → "}

                  {
                    evento.dados
                      .novaEtapa
                  }

                </p>

              )}


              {/* =================================
                  RESPONSÁVEL COMERCIAL
              ================================= */}

              <small>

                👤 {nomeResponsavel}

              </small>


            </div>

          )
        )

      )}

    </section>

  );

}
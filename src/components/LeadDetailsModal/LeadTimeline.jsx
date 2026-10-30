import { useEffect, useState } from "react";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

import {
  formatarData as formatarDataBR,
  formatarDataHora,
} from "../../utils/formatarData";

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


  // Padrão brasileiro DD/MM/AAAA HH:mm (utilitário compartilhado).
  function formatarData(timestamp) {
    return formatarDataHora(timestamp, "");
  }


  function tituloEvento(evento) {

    switch (evento.tipo) {


      case "WHATSAPP":

        return "📞 Primeiro Contato";


      case "WHATSAPP_LIVRE":

        return "💬 WhatsApp iniciado";


      case "RESPOSTA_LEAD":

        return "💬 Resposta do Lead";


      case "VISITA":

        if (
          evento.dados?.visitaAnterior
        ) {

          return "🔄 Visita Reagendada";

        }


        const descricaoMinuscula =
          evento.descricao
            ?.toLowerCase() || "";

        // "não compareceu" contém "compareceu": checar primeiro.
        if (
          descricaoMinuscula.includes("não compareceu") ||
          descricaoMinuscula.includes("nao compareceu")
        ) {

          return "🚫 Não Compareceu";

        }


        if (
          descricaoMinuscula.includes("reagendad")
        ) {

          return "🔄 Visita Reagendada";

        }


        if (
          descricaoMinuscula.includes("compareceu")
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


      case "MATRICULA_EDITADA":

        return "✏️ Matrícula Editada";


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


      case "NAO_FECHAMENTO":

        return "🚫 Não Fechamento";


      case "TRANSFERENCIA":

        return "🔄 Transferência";


      case "VISITA_CONFIRMACAO":

        return "✅ Visita Confirmada";


      case "VISITA_OBSERVACAO":

        return "📝 Observação da Visita";


      case "PENDENCIA":

        return "⚠️ Pendência";


      case "CADASTRO_GERENCIAL":

        return "🆕 Cadastro do Lead";


      case "RECUPERACAO":

        return "♻️ Recuperação";


      case "SEM_RESPOSTA":

        return "❌ Sem Resposta";


      case "RESPOSTA":

        return "💬 Resposta";


      case "REATIVACAO":

        return "🔄 Reativação";


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


  // ==========================================================
  // CADASTRO DO LEAD (entrada de leitura, NÃO é evento gravado)
  //
  // O cadastro comum de lead não gera evento na timeline (só o
  // cadastro gerencial gera CADASTRO_GERENCIAL). Para a trajetória
  // completa do cliente, mostramos a data de criação do próprio lead.
  // Some quando já existe o evento de cadastro, para não duplicar.
  // ==========================================================

  const cadastroSintetico =
    lead?.createdAt &&
    !historico.some(
      (evento) =>
        evento.tipo === "CADASTRO_GERENCIAL"
    )
      ? {
          data: lead.createdAt,
          origem: lead.origem || "",
          autor: lead.cadastradoPor || "",
        }
      : null;


  return (

    <section className="leadTimeline">

      <h3>
        📜 Timeline Comercial
      </h3>


      {historico.length === 0 && !cadastroSintetico ? (

        <p className="timelineEmpty">

          Nenhum evento registrado.

        </p>

      ) : (

        <>

        {historico.map(
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

                  {formatarDataBR(evento.dados.data)}

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

                    {formatarDataBR(
                      evento.dados
                        .visitaAnterior
                        .data
                    )}

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

                    {formatarDataBR(
                      evento.dados
                        .novaVisita
                        ?.data
                    )}

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
                  AUTOR DA AÇÃO E TITULAR DO LEAD
                  (duas informações distintas)
              ================================= */}

              <small className="timelineAutoria">

                {evento.usuario && (

                  <span>

                    ✍️ Registrado por: {evento.usuario}

                  </span>

                )}

                <span>

                  👤 Titular: {nomeResponsavel}

                </span>

              </small>


            </div>

          )
        )}

        {cadastroSintetico && (

          <div
            key="cadastro-do-lead"
            className="timelineItem"
          >

            <div
              className="timelineHeader"
            >

              <strong>

                🆕 Cadastro do Lead

              </strong>

              <span>

                {formatarData(
                  cadastroSintetico.data
                )}

              </span>

            </div>

            <p>

              Lead cadastrado
              {cadastroSintetico.origem
                ? ` (origem: ${cadastroSintetico.origem})`
                : ""}
              .

            </p>

            <small className="timelineAutoria">

              {cadastroSintetico.autor && (

                <span>

                  ✍️ Registrado por: {cadastroSintetico.autor}

                </span>

              )}

              <span>

                👤 Titular: {nomeResponsavel}

              </span>

            </small>

          </div>

        )}

        </>

      )}

    </section>

  );

}
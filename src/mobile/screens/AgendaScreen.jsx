import { useEffect, useState } from "react";

import "../styles/agenda.css";

import useLeads from "../../hooks/useLeads.js";

import useLeadsPontuais from "../../hooks/useLeadsPontuais.js";

import {
  buscarVisitasPorPerfil,
} from "../../Agenda/VisitaEngine.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";

import LeadDetailsScreen from "./LeadDetailsScreen.jsx";


// ==========================================================
// AGENDA — MOBILE (somente leitura, primeira etapa)
// ==========================================================
//
// Visitas: buscarVisitasPorPerfil() (src/Agenda/VisitaEngine.js,
// NÃO alterado, só importado) — mesma função, mesmos parâmetros
// (isAdmin, perfil, horaEntrada, horaSaida — sem uid) que o
// Dashboard Mobile já usa. Já filtrada por perfil/turno pela
// própria função, exatamente como no Desktop — nenhuma regra
// nova.
//
// Mostra só as visitas de HOJE, ordenadas por horário.
//
// Detalhes do lead: tocar no card abre LeadDetailsScreen
// (Mobile, já existente, não alterado). O lead vem primeiro do
// array local de useLeads() e, quando não está nesse escopo
// (ex.: visita de outra recepcionista, visível só por turno),
// cai no fallback pontual useLeadsPontuais() (src/hooks/
// useLeadsPontuais.js, NÃO alterado, só importado) — mesmo
// padrão já usado por Dashboard.jsx (Desktop): calcula os
// leadIds que faltam em `leads` a partir de toda a lista visível
// e busca só esses, pontualmente.
// ==========================================================

function obterDataHoje() {

  const hoje =
    new Date();

  const ano =
    hoje.getFullYear();

  const mes =
    String(hoje.getMonth() + 1)
      .padStart(2, "0");

  const dia =
    String(hoje.getDate())
      .padStart(2, "0");

  return `${ano}-${mes}-${dia}`;

}


export default function AgendaScreen() {

  const {
    isAdmin,
    perfilUsuario,
  } = useAuth();


  const {
    leads,
  } = useLeads();


  const [visitas, setVisitas] =
    useState([]);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] =
    useState(null);

  const [visitaAberta, setVisitaAberta] =
    useState(null);


  useEffect(() => {

    let cancelado = false;


    async function carregar() {

      try {

        setCarregando(true);

        setErro(null);


        const resultado =
          await buscarVisitasPorPerfil({

            isAdmin,

            perfil:
              perfilUsuario?.perfil,

            horaEntrada:
              perfilUsuario?.horaEntrada,

            horaSaida:
              perfilUsuario?.horaSaida,

          });


        if (!cancelado) {

          setVisitas(resultado);

        }

      } catch (erroCarregamento) {

        console.error(
          "Erro ao carregar Agenda (Mobile):",
          erroCarregamento
        );

        if (!cancelado) {

          setErro(
            "Não foi possível carregar a agenda."
          );

          setVisitas([]);

        }

      } finally {

        if (!cancelado) {

          setCarregando(false);

        }

      }

    }


    carregar();


    return () => {

      cancelado = true;

    };

  }, [
    isAdmin,
    perfilUsuario,
  ]);


  // ==========================================================
  // VISITAS DE HOJE, ORDENADAS POR HORÁRIO
  // ==========================================================

  const hojeString =
    obterDataHoje();

  const visitasHoje =
    visitas
      .filter(
        (visita) =>
          visita.data === hojeString
      )
      .sort(
        (a, b) =>
          (a.hora || "").localeCompare(
            b.hora || ""
          )
      );


  const leadIdsFaltantes =
    visitasHoje
      .filter(
        (visita) =>
          !leads.some(
            (lead) =>
              lead.id === visita.leadId
          )
      )
      .map(
        (visita) =>
          visita.leadId
      );

  const leadsPontuais =
    useLeadsPontuais(
      leadIdsFaltantes
    );

  function encontrarLead(visita) {

    return (
      leads.find(
        (lead) =>
          lead.id === visita.leadId
      ) ||
      leadsPontuais[visita.leadId] ||
      null
    );

  }


  // ==========================================================
  // DETALHES DO LEAD (reaproveita LeadDetailsScreen já existente)
  // ==========================================================

  if (visitaAberta) {

    return (

      <LeadDetailsScreen
        lead={visitaAberta}
        onVoltar={() =>
          setVisitaAberta(null)
        }
      />

    );

  }


  // ==========================================================
  // LISTA
  // ==========================================================

  return (

    <div className="mobileAgenda">

      <header className="mobileAgendaHeader">

        <span className="mobileAgendaHeaderTag">
          📅 Agenda
        </span>

        <h1>
          Visitas de hoje
        </h1>

      </header>


      {carregando && (

        <div className="mobileAgendaEstado">
          Carregando visitas...
        </div>

      )}


      {!carregando &&
        erro && (

        <div className="mobileAgendaEstado mobileAgendaEstadoErro">
          ⚠️ {erro}
        </div>

      )}


      {!carregando &&
        !erro &&
        visitasHoje.length === 0 && (

        <div className="mobileAgendaEstado">
          Nenhuma visita agendada para hoje.
        </div>

      )}


      {!carregando &&
        !erro &&
        visitasHoje.length > 0 && (

        <div className="mobileAgendaLista">

          {visitasHoje.map((visita) => {

            const lead =
              encontrarLead(visita);

            const confirmada =
              visita.status ===
              "CONFIRMADA";

            const naoCompareceu =
              visita.comparecimento ===
              "NAO_COMPARECEU";

            const clicavel =
              !!lead;

            return (

              <button
                type="button"
                key={visita.id}
                className={`
                  mobileAgendaCard
                  ${
                    naoCompareceu
                      ? "mobileAgendaCardNaoCompareceu"
                      : ""
                  }
                `}
                onClick={
                  clicavel
                    ? () =>
                        setVisitaAberta(lead)
                    : undefined
                }
                disabled={!clicavel}
              >

                <div className="mobileAgendaCardTopo">

                  <span className="mobileAgendaCardHora">
                    🕐 {visita.hora || "--:--"}
                  </span>

                  <span
                    className={`
                      mobileAgendaCardStatus
                      ${
                        confirmada
                          ? "mobileAgendaCardStatusConfirmada"
                          : "mobileAgendaCardStatusPendente"
                      }
                    `}
                  >

                    {confirmada
                      ? "🟢 Confirmada"
                      : "🔴 Aguardando"}

                  </span>

                </div>


                <strong className="mobileAgendaCardNome">
                  {visita.leadNome || "Lead"}
                </strong>


                <span className="mobileAgendaCardConsultora">
                  👤{" "}
                  {visita.consultora ||
                    "Não informado"}
                </span>


                {naoCompareceu && (

                  <span className="mobileAgendaCardAlerta">
                    🔴 Não compareceu
                  </span>

                )}


                {!clicavel && (

                  <span className="mobileAgendaCardSemAcesso">
                    Detalhes indisponíveis para este lead
                  </span>

                )}

              </button>

            );

          })}

        </div>

      )}

    </div>

  );

}

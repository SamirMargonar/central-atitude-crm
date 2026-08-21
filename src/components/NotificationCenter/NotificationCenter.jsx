import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ETAPAS,
} from "../../core/LeadFlow";

import {
  buscarVisitasPorPerfil,
} from "../../Agenda/VisitaEngine";

import {
  useAuth,
} from "../../auth/AuthContext";

import "./NotificationCenter.css";


export default function NotificationCenter({
  leads = [],
  setPagina,
}) {

  const audio =
    useRef(null);


  const {
    isAdmin,
    perfilUsuario,
    permissoes,
  } = useAuth();


  const [
    notificacoesLeads,
    setNotificacoesLeads,
  ] = useState([]);


  const [
    notificacoesVisitas,
    setNotificacoesVisitas,
  ] = useState([]);


  // ==========================================================
  // QUEM PODE OUVIR O ALERTA DE NOVO LEAD
  // ==========================================================
  //
  // Formalizado pela matriz central de permissões
  // (core/Permissions.js): somente recepcionista ouve o
  // alerta de novo lead. Admin e coordenador nunca ouvem.
  //
  // O comportamento é o mesmo de antes — só a fonte da
  // regra mudou de uma comparação de string solta para a
  // matriz de permissões.
  // ==========================================================

  const ehRecepcionista =
    permissoes.alertaSonoroNovoLead;


  // ==========================================================
  // DATA DE HOJE
  // ==========================================================

  function obterDataHoje() {

    const agora =
      new Date();


    const ano =
      agora.getFullYear();


    const mes =
      String(
        agora.getMonth() + 1
      )
        .padStart(2, "0");


    const dia =
      String(
        agora.getDate()
      )
        .padStart(2, "0");


    return `${ano}-${mes}-${dia}`;

  }


  // ==========================================================
  // CONVERTE HH:MM PARA MINUTOS
  // ==========================================================

  function converterHoraParaMinutos(
    hora
  ) {

    if (!hora) {

      return null;

    }


    const partes =
      hora.split(":");


    if (
      partes.length < 2
    ) {

      return null;

    }


    const horas =
      Number(
        partes[0]
      );


    const minutos =
      Number(
        partes[1]
      );


    if (
      Number.isNaN(horas) ||
      Number.isNaN(minutos)
    ) {

      return null;

    }


    return (
      horas * 60 +
      minutos
    );

  }


  // ==========================================================
  // MINUTOS ATUAIS
  // ==========================================================

  function obterMinutosAgora() {

    const agora =
      new Date();


    return (
      agora.getHours() * 60 +
      agora.getMinutes()
    );

  }


  // ==========================================================
  // VERIFICA SE A VISITA ESTÁ CONFIRMADA
  // ==========================================================

  function visitaConfirmada(
    visita
  ) {

    return (

      visita?.confirmada === true ||

      visita?.status === "CONFIRMADA" ||

      visita?.status === "confirmada" ||

      visita?.status === "Confirmada"

    );

  }


  // ==========================================================
  // NOVOS LEADS
  // ==========================================================
  //
  // IMPORTANTE:
  //
  // A VISIBILIDADE do Lead continua sendo controlada pelo
  // useLeads().
  //
  // Aqui estamos cuidando somente das notificações.
  //
  // REGRA:
  //
  // 1. Recepcionista cadastrou:
  //    → não existe alerta sonoro.
  //
  // 2. Coordenador cadastrou:
  //    → somente recepcionistas recebem o som.
  //
  // 3. Administrador cadastrou:
  //    → somente recepcionistas recebem o som.
  //
  // ==========================================================

  useEffect(() => {

    const novosLeads =
      leads.filter(
        (lead) => {

          const etapa =
            Number(
              lead.etapa ??
              ETAPAS.RECEBIDO
            );


          return (

            etapa ===
              ETAPAS.RECEBIDO &&

            !lead.assumido

          );

        }
      );


    // ========================================================
    // NOTIFICAÇÕES VISUAIS
    // ========================================================

    const novasNotificacoes =
      novosLeads.map(
        (lead) => ({

          id:
            `lead-${lead.id}`,

          tipo:
            "NOVO_LEAD",

          titulo:
            "🚨 Novo Lead recebido!",

          mensagem:
            `${lead.nome || "Novo cliente"} entrou no CRM.`,

          leadId:
            lead.id,

          prioridade:
            "alta",

        })
      );


    setNotificacoesLeads(
      novasNotificacoes
    );

  }, [leads]);


  // ==========================================================
  // MONITORAMENTO DAS VISITAS
  // ==========================================================

  useEffect(() => {

    let desmontado =
      false;


    async function verificarVisitas() {

      try {

        // ------------------------------------------------------
        // Admin/coordenador: consulta ampla (igual a antes).
        // Recepcionista: consulta já vem pré-filtrada pelo
        // próprio turno (horaEntrada/horaSaida), independente
        // de quem é o responsável pelo Lead.
        // ------------------------------------------------------

        const visitas =
          await buscarVisitasPorPerfil({

            isAdmin,

            perfil:
              perfilUsuario?.perfil,

            horaEntrada:
              perfilUsuario?.horaEntrada,

            horaSaida:
              perfilUsuario?.horaSaida,

          });


        if (
          desmontado
        ) {

          return;

        }


        const hoje =
          obterDataHoje();


        const agora =
          obterMinutosAgora();


        const alertas = [];


        visitas.forEach(
          (visita) => {

            if (!visita) {

              return;

            }


            // ==================================================
            // SEM DATA OU HORA
            // ==================================================

            if (
              !visita.data ||
              !visita.hora
            ) {

              return;

            }


            // ==================================================
            // VISITA CONFIRMADA
            // ==================================================

            if (
              visitaConfirmada(
                visita
              )
            ) {

              return;

            }


            // ==================================================
            // SOMENTE VISITAS DE HOJE
            // ==================================================

            if (
              visita.data !==
              hoje
            ) {

              return;

            }


            const horarioVisita =
              converterHoraParaMinutos(
                visita.hora
              );


            if (
              horarioVisita ===
              null
            ) {

              return;

            }


            const diferenca =
              horarioVisita -
              agora;


            const nome =
              visita.leadNome ||
              visita.nome ||
              "Cliente";


            // ==================================================
            // VISITA ATRASADA
            // ==================================================

            if (
              diferenca < 0
            ) {

              alertas.push({

                id:
                  `visita-atrasada-${visita.id}-${visita.data}-${visita.hora}`,

                tipo:
                  "VISITA_ATRASADA",

                titulo:
                  "⚠️ Visita não confirmada",

                mensagem:
                  `${nome} tinha visita às ${visita.hora} e ela ainda não foi confirmada.`,

                leadId:
                  visita.leadId,

                visitaId:
                  visita.id,

                data:
                  visita.data,

                hora:
                  visita.hora,

                prioridade:
                  "alta",

              });

              return;

            }


            // ==================================================
            // VISITA NAS PRÓXIMAS 2 HORAS
            // ==================================================

            if (
              diferenca <= 120
            ) {

              alertas.push({

                id:
                  `visita-proxima-${visita.id}-${visita.data}-${visita.hora}`,

                tipo:
                  "VISITA_PROXIMA",

                titulo:
                  "📅 Visita próxima",

                mensagem:
                  `${nome} tem visita hoje às ${visita.hora}. Confirme o comparecimento.`,

                leadId:
                  visita.leadId,

                visitaId:
                  visita.id,

                data:
                  visita.data,

                hora:
                  visita.hora,

                prioridade:
                  diferenca <= 30
                    ? "alta"
                    : "media",

              });

            }

          }
        );


        setNotificacoesVisitas(
          alertas
        );


      } catch (erro) {

        console.error(
          "Erro ao verificar visitas:",
          erro
        );

      }

    }


    verificarVisitas();


    const intervalo =
      setInterval(
        verificarVisitas,
        5000
      );


    return () => {

      desmontado = true;

      clearInterval(
        intervalo
      );

    };

  }, [
    isAdmin,
    perfilUsuario,
  ]);


  // ==========================================================
  // ALERTA SONORO
  // ==========================================================
  //
  // NOVO LEAD:
  //
  // → somente RECEPCIONISTAS podem ouvir.
  //
  // → coordenador NÃO ouve.
  //
  // → administrador NÃO ouve.
  //
  // → se uma recepcionista cadastrou o próprio Lead,
  //   ela também NÃO deve ouvir.
  //
  // VISITAS:
  //
  // → continuam utilizando o comportamento atual.
  //
  // ==========================================================

  useEffect(() => {

    // ========================================================
    // VERIFICA NOVOS LEADS QUE DEVEM GERAR SOM
    // ========================================================

    const deveTocarNovoLead =
      ehRecepcionista &&
      notificacoesLeads.some(
        (notificacao) => {

          const lead =
            leads.find(
              (item) =>
                item.id ===
                notificacao.leadId
            );


          if (!lead) {

            return false;

          }


          // --------------------------------------------------
          // Se a própria recepcionista cadastrou o Lead,
          // não toca para ela.
          // --------------------------------------------------

          const uidUsuario =
            String(
              perfilUsuario?.uid ||
              perfilUsuario?.id ||
              ""
            )
              .trim();


          const uidCadastro =
            String(
              lead.cadastradoPorUid ||
              ""
            )
              .trim();


          if (
            uidUsuario &&
            uidCadastro &&
            uidUsuario ===
            uidCadastro
          ) {

            return false;

          }


          // --------------------------------------------------
          // Compatibilidade por nome
          // --------------------------------------------------

          const nomeUsuario =
            String(
              perfilUsuario?.nome ||
              ""
            )
              .trim()
              .toLowerCase();


          const nomeCadastro =
            String(
              lead.cadastradoPor ||
              ""
            )
              .trim()
              .toLowerCase();


          if (
            nomeUsuario &&
            nomeCadastro &&
            nomeUsuario ===
            nomeCadastro
          ) {

            return false;

          }


          // --------------------------------------------------
          // É um Lead cadastrado por alguém que não é
          // essa recepcionista.
          // --------------------------------------------------

          return true;

        }
      );


    // ========================================================
    // ALERTAS DE VISITAS
    // ========================================================

    const deveTocarVisita =
      notificacoesVisitas.length >
      0;


    const deveTocar =
      deveTocarNovoLead ||
      deveTocarVisita;


    // ========================================================
    // TOCAR
    // ========================================================

    if (
      deveTocar &&
      audio.current
    ) {

      audio.current.loop =
        true;


      audio.current
        .play()
        .catch(
          (erro) => {

            console.warn(
              "O navegador bloqueou o áudio automático:",
              erro
            );

          }
        );

    }


    // ========================================================
    // PARAR
    // ========================================================

    if (
      !deveTocar &&
      audio.current
    ) {

      audio.current.pause();

      audio.current.currentTime =
        0;

    }

  }, [
    notificacoesLeads,
    notificacoesVisitas,
    leads,
    ehRecepcionista,
    perfilUsuario,
  ]);


  // ==========================================================
  // TODAS AS NOTIFICAÇÕES
  // ==========================================================

  const notificacoes = [

    ...notificacoesLeads,

    ...notificacoesVisitas,

  ];


  // ==========================================================
  // ABRIR LEAD
  // ==========================================================

  function abrirLead(
    leadId
  ) {

    if (setPagina) {

      setPagina(
        "leads"
      );

    }


    setNotificacoesLeads(
      (anteriores) =>
        anteriores.filter(
          (notificacao) =>
            notificacao.leadId !==
            leadId
        )
    );

  }


  // ==========================================================
  // ABRIR AGENDA
  // ==========================================================

  function abrirAgenda() {

    if (setPagina) {

      setPagina(
        "agenda"
      );

    }

  }


  // ==========================================================
  // FECHAR NOTIFICAÇÃO
  // ==========================================================

  function fecharNotificacao(
    notificacao
  ) {

    // ========================================================
    // NOVO LEAD
    // ========================================================

    if (
      notificacao.tipo ===
      "NOVO_LEAD"
    ) {

      setNotificacoesLeads(
        (anteriores) =>
          anteriores.filter(
            (item) =>
              item.id !==
              notificacao.id
          )
      );

      return;

    }


    // ========================================================
    // VISITA
    // ========================================================

    if (
      notificacao.tipo ===
        "VISITA_PROXIMA" ||

      notificacao.tipo ===
        "VISITA_ATRASADA"
    ) {

      return;

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      {/* =====================================================
          ÁUDIO
      ===================================================== */}

      <audio
        ref={audio}
        src="/notification.mp3"
        preload="auto"
        loop
      />


      {/* =====================================================
          CENTRAL DE NOTIFICAÇÕES
      ===================================================== */}

      <div className="notificationCenter">

        {notificacoes.map(
          (notificacao) => (

            <div
              key={
                notificacao.id
              }
              className={`
                notificationCard
                ${
                  notificacao.prioridade ===
                  "alta"
                    ? "notificationAlta"
                    : notificacao.prioridade ===
                      "media"
                    ? "notificationMedia"
                    : ""
                }
              `}
            >

              {/* =============================================
                  FECHAR
              ============================================= */}

              <button
                className="notificationClose"
                onClick={() =>
                  fecharNotificacao(
                    notificacao
                  )
                }
              >
                ×
              </button>


              {/* =============================================
                  TÍTULO
              ============================================= */}

              <div className="notificationTitulo">

                {
                  notificacao.titulo
                }

              </div>


              {/* =============================================
                  MENSAGEM
              ============================================= */}

              <div className="notificationMensagem">

                {
                  notificacao.mensagem
                }

              </div>


              {/* =============================================
                  AÇÕES
              ============================================= */}

              <div className="notificationActions">

                {/* ===========================================
                    NOVO LEAD
                =========================================== */}

                {
                  notificacao.tipo ===
                    "NOVO_LEAD" && (

                    <button
                      className="notificationButton"
                      onClick={() =>
                        abrirLead(
                          notificacao.leadId
                        )
                      }
                    >
                      👤 Ver Lead
                    </button>

                  )
                }


                {/* ===========================================
                    VISITA
                =========================================== */}

                {(
                  notificacao.tipo ===
                    "VISITA_PROXIMA" ||

                  notificacao.tipo ===
                    "VISITA_ATRASADA"

                ) && (

                  <button
                    className="notificationButton"
                    onClick={
                      abrirAgenda
                    }
                  >
                    📅 Abrir Agenda
                  </button>

                )}

              </div>

            </div>

          )
        )}

      </div>

    </>

  );

}
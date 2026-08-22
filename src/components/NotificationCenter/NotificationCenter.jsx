import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  arrayUnion,
} from "firebase/firestore";

import {
  ETAPAS,
} from "../../core/LeadFlow";

import {
  buscarVisitasPorPerfil,
} from "../../Agenda/VisitaEngine";

import {
  atualizarLead,
} from "../../core/EventEngine";

import {
  calcularAlertasRenovacao,
} from "../../utils/renovacaoAlertas";

import {
  useAuth,
} from "../../auth/AuthContext";

import "./NotificationCenter.css";


// ==========================================================
// PERSISTÊNCIA (localStorage) DAS VISITAS DISPENSADAS
// ==========================================================
//
// Sobrevive a refresh sem escrever no Firestore. Chave por
// usuário (uid do Firebase Auth), para que o dismiss de um
// usuário nunca esconda a visita para outro. O valor guardado
// é só a lista de ids de alerta (mesmo formato usado em
// notificacoesVisitas) — nenhum dado da visita em si.
// ==========================================================

function chaveVisitasDispensadas(uid) {

  return (
    `centralAtitude:notificacoesVisitasDispensadas:${uid}`
  );

}


function carregarVisitasDispensadas(uid) {

  if (!uid) {

    return new Set();

  }

  try {

    const bruto =
      window.localStorage.getItem(
        chaveVisitasDispensadas(uid)
      );

    if (!bruto) {

      return new Set();

    }

    const lista =
      JSON.parse(bruto);

    return new Set(
      Array.isArray(lista) ? lista : []
    );

  } catch {

    return new Set();

  }

}


function salvarVisitasDispensadas(uid, idsDispensados) {

  if (!uid) {

    return;

  }

  try {

    window.localStorage.setItem(
      chaveVisitasDispensadas(uid),
      JSON.stringify(
        Array.from(idsDispensados)
      )
    );

  } catch {

    // localStorage indisponível (modo privado, quota, etc.):
    // o dismiss ainda funciona nesta sessão, só não sobrevive
    // a um refresh.

  }

}


export default function NotificationCenter({
  leads = [],
  setPagina,
}) {

  const audio =
    useRef(null);


  const {
    usuario,
    isAdmin,
    isCoordenador,
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


  const [
    notificacoesRenovacao,
    setNotificacoesRenovacao,
  ] = useState([]);


  const idsRenovacaoTratados =
    useRef(new Set());


  // ==========================================================
  // ALERTAS DE VISITA JÁ DISPENSADOS
  // ==========================================================
  //
  // verificarVisitas() roda a cada 5s e recria o array de
  // alertas do zero a partir da consulta de visitas — sem isso,
  // um alerta dispensado pelo X voltaria a aparecer no próximo
  // ciclo. Só entra aqui quem foi dispensado (isAdmin/
  // isCoordenador); nunca afeta a confirmação real da visita.
  //
  // Espelhado no localStorage (por uid) para sobreviver a um
  // refresh da página — ver carregarVisitasDispensadas /
  // salvarVisitasDispensadas no topo do arquivo.
  // ==========================================================

  const idsVisitaDispensados =
    useRef(new Set());


  // ==========================================================
  // HIDRATA OS DISPENSADOS DO localStorage PARA ESTE USUÁRIO
  // ==========================================================
  //
  // Roda quando o uid fica disponível (login) — antes do efeito
  // de polling das visitas, que é declarado depois. Assim o
  // primeiro ciclo de verificarVisitas() já enxerga os ids
  // dispensados em sessões/refreshes anteriores.
  // ==========================================================

  useEffect(() => {

    idsVisitaDispensados.current =
      carregarVisitasDispensadas(
        usuario?.uid
      );

  }, [usuario?.uid]);


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
  // ALERTAS DE RENOVAÇÃO (marcos de 60 / 20 / 7 dias)
  // ==========================================================
  //
  // Sem polling: recalcula só quando `leads` muda (já é
  // realtime via useLeads). Cada alerta (leadId + dataVencimento
  // + marco) só é tratado uma vez por sessão do componente,
  // via idsRenovacaoTratados — evita reprocessar/repersistir o
  // mesmo alerta a cada pequena mudança em `leads` antes do
  // round-trip do Firestore terminar.
  //
  // Persistência: alertasRenovacaoEnviados é um array de chaves
  // no próprio lead, atualizado com arrayUnion (nunca sobrescreve
  // matricula nem qualquer outro campo). Falha de permissão
  // (ex.: recepcionista que não é dona do lead) é tratada com
  // try/catch — o alerta ainda aparece nesta sessão, só não fica
  // persistido até uma sessão com permissão gravar.
  //
  // Alerta é só visual — não entra na lógica de áudio abaixo.
  // ==========================================================

  useEffect(() => {

    const alertasJaEnviados =
      new Set(
        leads.flatMap(
          (lead) =>
            lead.alertasRenovacaoEnviados || []
        )
      );

    const alertasPendentes =
      calcularAlertasRenovacao(
        leads,
        alertasJaEnviados,
        new Date()
      ).filter(
        (alerta) =>
          !idsRenovacaoTratados.current.has(
            alerta.id
          )
      );

    if (alertasPendentes.length === 0) {

      return;

    }

    alertasPendentes.forEach(
      (alerta) => {

        idsRenovacaoTratados.current.add(
          alerta.id
        );

      }
    );

    setNotificacoesRenovacao(
      (anteriores) => [

        ...anteriores,

        ...alertasPendentes.map(
          (alerta) => {

            const lead =
              leads.find(
                (item) =>
                  item.id === alerta.leadId
              );

            return {

              id: alerta.id,

              tipo: "RENOVACAO_PROXIMA",

              titulo:
                "🔄 Renovação próxima",

              mensagem:
                `${lead?.nome || "Aluno"} vence em ${alerta.dias} dia(s) (marco de ${alerta.marco} dias antes).`,

              leadId: alerta.leadId,

              prioridade:
                alerta.marco === 7
                  ? "alta"
                  : alerta.marco === 20
                  ? "media"
                  : "",

            };

          }
        ),

      ]
    );

    alertasPendentes.forEach(
      (alerta) => {

        atualizarLead(
          alerta.leadId,
          {

            alertasRenovacaoEnviados:
              arrayUnion(alerta.id),

          }
        ).catch(
          (erro) => {

            console.warn(
              "Não foi possível persistir o alerta de renovação (permissão ou rede):",
              erro
            );

          }
        );

      }
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

                // Id estável, independente de "próxima"/"atrasada":
                // a mesma visita pode cruzar de um tipo para o
                // outro entre um ciclo de polling e o seguinte
                // (o tempo passa), e o dismiss (idsVisitaDispensados)
                // precisa continuar reconhecendo como a mesma
                // notificação mesmo depois da troca de tipo.
                id:
                  `visita-${visita.id}-${visita.data}-${visita.hora}`,

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

                // Mesmo id estável usado no ramo "atrasada" acima
                // (sem prefixo por tipo) — ver comentário lá.
                id:
                  `visita-${visita.id}-${visita.data}-${visita.hora}`,

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


        // ------------------------------------------------------
        // PODA: remove do Set (e do localStorage) qualquer id
        // dispensado que não corresponde mais a um alerta ativo
        // (visita confirmada, excluída, ou já não é mais "hoje")
        // — evita crescimento infinito do armazenamento.
        // ------------------------------------------------------

        const idsAtivos =
          new Set(
            alertas.map(
              (alerta) => alerta.id
            )
          );

        let podouAlgum =
          false;

        idsVisitaDispensados.current.forEach(
          (idDispensado) => {

            if (
              !idsAtivos.has(
                idDispensado
              )
            ) {

              idsVisitaDispensados.current.delete(
                idDispensado
              );

              podouAlgum = true;

            }

          }
        );

        if (podouAlgum) {

          salvarVisitasDispensadas(
            usuario?.uid,
            idsVisitaDispensados.current
          );

        }


        setNotificacoesVisitas(
          alertas.filter(
            (alerta) =>
              !idsVisitaDispensados.current.has(
                alerta.id
              )
          )
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
    usuario?.uid,
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
  // → mesma regra do novo lead: somente RECEPCIONISTA ouve.
  //   Coordenador e administrador veem o alerta visual
  //   normalmente, sem som.
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
    //
    // Mesma regra do novo lead: só recepcionista ouve o som.
    // O alerta visual continua aparecendo para todos os
    // perfis — só o áudio é restrito aqui.
    // ========================================================

    const deveTocarVisita =
      ehRecepcionista &&
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

    ...notificacoesRenovacao,

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
    //
    // Regra: fechar o X ≠ confirmar a visita. O X aqui só
    // remove o alerta do estado local (React) desta sessão —
    // nunca grava nada no Firestore, nunca toca em
    // comparecimento/status/etapa da visita ou do lead.
    //
    // Somente isAdmin/isCoordenador podem dispensar sem
    // confirmar. Recepcionista não pode: para ela, o alerta só
    // some quando a visita for de fato confirmada (nesse caso
    // visitaConfirmada() já filtra o alerta fora em
    // verificarVisitas(), nem chega a existir mais aqui).
    // ========================================================

    if (
      notificacao.tipo ===
        "VISITA_PROXIMA" ||

      notificacao.tipo ===
        "VISITA_ATRASADA"
    ) {

      if (
        !isAdmin &&
        !isCoordenador
      ) {

        return;

      }


      idsVisitaDispensados.current.add(
        notificacao.id
      );

      salvarVisitasDispensadas(
        usuario?.uid,
        idsVisitaDispensados.current
      );

      setNotificacoesVisitas(
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
    // RENOVAÇÃO
    // ========================================================

    if (
      notificacao.tipo ===
      "RENOVACAO_PROXIMA"
    ) {

      setNotificacoesRenovacao(
        (anteriores) =>
          anteriores.filter(
            (item) =>
              item.id !==
              notificacao.id
          )
      );

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
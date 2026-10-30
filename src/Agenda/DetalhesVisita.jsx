import { useEffect, useRef, useState } from "react";

import "./Agenda.css";

import {
  atualizarVisita,
} from "./VisitaEngine";

import {
  confirmarVisita as confirmarVisitaEngine,
  registrarAtendimento,
} from "../core/VisitaEngine";

import {
  atualizarLead,
  registrarEvento,
} from "../core/EventEngine";

import {
  ETAPAS,
  nomeDaEtapa,
} from "../core/LeadFlow";

import {
  useAuth,
} from "../auth/AuthContext";

import ConfirmarVisitaWhatsAppModal from "./ConfirmarVisitaWhatsAppModal";


import LeadTimeline from "../components/LeadDetailsModal/LeadTimeline";

import BotaoWhatsAppCliente from "../components/BotaoWhatsAppCliente";

import { reagendamentoAgenda } from "./reagendamentoAgendaReal";


export default function DetalhesVisita({
  visita,
  lead,
  aberto,
  fechar,
  onAtualizar,
}) {

  // ==========================================================
  // USUÁRIO LOGADO
  // ==========================================================

  const {
    usuario,
    perfilUsuario,
    isAdmin,
    isRecepcionista,
  } = useAuth();


  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [modoReagendar, setModoReagendar] =
    useState(false);

  const [modoComparecimento, setModoComparecimento] =
    useState(false);

  const [modoObservacao, setModoObservacao] =
    useState(false);


  // Aba "Histórico": mostra a Timeline do LEAD (a mesma do cadastro
  // do lead), incluindo visitas anteriores — não só a visita atual.
  const [historicoAberto, setHistoricoAberto] =
    useState(false);

  // Trava contra duplo clique em "Reagendar": o estado `salvando` só
  // muda no próximo render, então duas chamadas seguidas ainda
  // passariam — e gravariam dois eventos iguais na Timeline.
  const reagendandoRef = useRef(false);

  const [data, setData] =
    useState("");

  const [hora, setHora] =
    useState("");

  const [consultora, setConsultora] =
    useState("");

  const [observacao, setObservacao] =
    useState("");

  const [salvando, setSalvando] =
    useState(false);

  const [modoConfirmarWhatsApp, setModoConfirmarWhatsApp] =
    useState(false);


  // ==========================================================
  // DADOS DO USUÁRIO ATUAL
  // ==========================================================

  const usuarioAtual = {

    uid:
      usuario?.uid ||
      perfilUsuario?.uid ||
      null,

    nome:
      perfilUsuario?.nome ||
      usuario?.displayName ||
      usuario?.email ||
      "Usuário",

    email:
      usuario?.email ||
      perfilUsuario?.email ||
      "",

  };


  // ==========================================================
  // ATUALIZA CAMPOS QUANDO MUDA A VISITA
  // ==========================================================

  useEffect(() => {

    if (!visita) {
      return;
    }

    setData(
      visita.data || ""
    );

    setHora(
      visita.hora || ""
    );

    setConsultora(
      visita.consultora || ""
    );

    setObservacao(
      visita.observacao || ""
    );

    setModoReagendar(false);

    setModoComparecimento(false);

    setModoObservacao(false);

  }, [visita]);

  // O histórico recolhe só quando muda de VISITA (não a cada
  // atualização da mesma visita).
  useEffect(() => {

    setHistoricoAberto(false);

  }, [visita?.id]);


  // ==========================================================
  // SE NÃO ESTIVER ABERTO
  // ==========================================================

  if (!aberto || !visita) {

    return null;

  }


  // ==========================================================
  // CONFIRMAR VISITA
  // ==========================================================

  async function confirmarVisita() {

    if (!usuarioAtual.uid) {

      alert(
        "Não foi possível identificar o usuário logado."
      );

      return;

    }


    try {

      setSalvando(true);


      const visitaAtualizada =
        await confirmarVisitaEngine(
          visita.id,
          usuarioAtual
        );


      // ------------------------------------------------------
      // ATUALIZA TELA
      // ------------------------------------------------------

      if (onAtualizar) {

        onAtualizar({

          ...visita,

          ...visitaAtualizada,

        });

      }


      // ------------------------------------------------------
      // HISTÓRICO
      // ------------------------------------------------------

      const leadId =
        lead?.id ||
        visita.leadId;


      if (leadId) {

        await registrarEvento({

          leadId,

          tipo:
            "VISITA_CONFIRMACAO",

          usuario:
            usuarioAtual.nome,

          descricao:
            `${usuarioAtual.nome} confirmou a visita de ${lead?.nome || visita.leadNome || "Lead"}.`,

          dados: {

            visitaId:
              visita.id,

            confirmadoPor:
              usuarioAtual.uid,

            confirmadoPorNome:
              usuarioAtual.nome,

            data:
              visita.data || "",

            hora:
              visita.hora || "",

          },

        });

      }


      // ------------------------------------------------------
      // ABRE A MODAL DE MENSAGEM DO WHATSAPP
      //
      // Só depois que confirmarVisitaEngine() e o registro da
      // Timeline (VISITA_CONFIRMACAO) já tiverem sucesso. A
      // modal é quem efetivamente abre o WhatsApp, a partir de
      // um clique real do usuário — não precisa mais do truque
      // de abrir a aba em branco antes do await.
      // ------------------------------------------------------

      if (lead?.telefone) {

        setModoConfirmarWhatsApp(true);

      }

    } catch (erro) {

      console.error(
        "Erro ao confirmar visita:",
        erro
      );

      alert(
        "Não foi possível confirmar a visita."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // REGISTRAR COMPARECIMENTO
  // ==========================================================

  async function registrarComparecimento(
    tipo
  ) {

    if (!usuarioAtual.uid) {

      alert(
        "Não foi possível identificar o usuário logado."
      );

      return;

    }


    try {

      setSalvando(true);


      const leadId =
        lead?.id ||
        visita.leadId;


      const etapaAnterior =
        lead?.etapa ??
        ETAPAS.VISITA;


      // ======================================================
      // REGISTRA QUEM ATENDEU
      // ======================================================

      const visitaAtualizada =
        await registrarAtendimento(
          visita.id,
          usuarioAtual,
          observacao
        );


      // ======================================================
      // ATUALIZA COMPARECIMENTO
      //
      // NAO_COMPARECEU reabre a pendência operacional
      // (pendenciaResolvida: false) — mesmo que essa mesma
      // visita já tenha sido resolvida antes (contato ou
      // reagendamento). Ver auditoria "Lead não compareceu".
      // ======================================================

      const dadosComparecimento = {

        comparecimento:
          tipo,

        status:
          "CONFIRMADA",

        ...(tipo === "NAO_COMPARECEU"
          ? {
              pendenciaResolvida:
                false,
            }
          : {}),

      };


      await atualizarVisita(
        visita.id,
        dadosComparecimento
      );


      // ======================================================
      // ATUALIZA TELA
      // ======================================================

      if (onAtualizar) {

        onAtualizar({

          ...visita,

          ...visitaAtualizada,

          ...dadosComparecimento,

          atendidoPor:
            usuarioAtual.uid,

          atendidoPorNome:
            usuarioAtual.nome,

          observacao,

        });

      }


      // ======================================================
      // CLIENTE COMPARECEU
      // VISITA → NEGOCIAÇÃO
      // ======================================================

      if (
        tipo === "COMPARECEU"
      ) {

        if (leadId) {

          const agora =
            new Date().toLocaleString(
              "pt-BR"
            );


          // --------------------------------------------------
          // ATUALIZA LEAD
          // --------------------------------------------------

          await atualizarLead(
            leadId,
            {

              etapa:
                ETAPAS.NEGOCIACAO,

              ultimoAtendimento:
                agora,

              alertaNaoCompareceu:
                false,

              ultimaVisitaId:
                visita.id,

            }
          );


          // --------------------------------------------------
          // ATUALIZA LEAD LOCAL
          // --------------------------------------------------

          if (
            lead &&
            typeof lead === "object"
          ) {

            Object.assign(
              lead,
              {

                etapa:
                  ETAPAS.NEGOCIACAO,

                ultimoAtendimento:
                  agora,

                alertaNaoCompareceu:
                  false,

              }
            );

          }


          // --------------------------------------------------
          // HISTÓRICO
          // --------------------------------------------------

          await registrarEvento({

            leadId,

            tipo:
              "VISITA",

            usuario:
              usuarioAtual.nome,

            descricao:
              `${usuarioAtual.nome} registrou que o cliente compareceu à visita.`,

            dados: {

              visitaId:
                visita.id,

              data:
                visita.data || "",

              hora:
                visita.hora || "",

              comparecimento:
                "COMPARECEU",

              atendidoPor:
                usuarioAtual.uid,

              atendidoPorNome:
                usuarioAtual.nome,

            },

          });


          // --------------------------------------------------
          // JORNADA
          // --------------------------------------------------

          await registrarEvento({

            leadId,

            tipo:
              "JORNADA",

            usuario:
              usuarioAtual.nome,

            descricao:
              `${lead?.nome || visita.leadNome || "Lead"} avançou para "${nomeDaEtapa(ETAPAS.NEGOCIACAO)}"`,

            dados: {

              etapaAnterior,

              novaEtapa:
                ETAPAS.NEGOCIACAO,

              motivo:
                "Comparecimento à visita",

              visitaId:
                visita.id,

              atendidoPor:
                usuarioAtual.uid,

              atendidoPorNome:
                usuarioAtual.nome,

            },

          });

        }

      }


      // ======================================================
      // CLIENTE NÃO COMPARECEU
      // ======================================================

      if (
        tipo === "NAO_COMPARECEU"
      ) {

        if (leadId) {

          const agora =
            new Date().toLocaleString(
              "pt-BR"
            );


          // --------------------------------------------------
          // ATUALIZA LEAD
          // --------------------------------------------------

          await atualizarLead(
            leadId,
            {

              etapa:
                ETAPAS.VISITA,

              ultimoAtendimento:
                agora,

              alertaNaoCompareceu:
                true,

              alertaNaoCompareceuEm:
                agora,

              alertaNaoCompareceuVisitaId:
                visita.id,

              pendenciaComercial:
                "NOVO_CONTATO_NAO_COMPARECIMENTO",

            }
          );


          // --------------------------------------------------
          // ATUALIZA LEAD LOCAL
          // --------------------------------------------------

          if (
            lead &&
            typeof lead === "object"
          ) {

            Object.assign(
              lead,
              {

                etapa:
                  ETAPAS.VISITA,

                ultimoAtendimento:
                  agora,

                alertaNaoCompareceu:
                  true,

                alertaNaoCompareceuEm:
                  agora,

                alertaNaoCompareceuVisitaId:
                  visita.id,

                pendenciaComercial:
                  "NOVO_CONTATO_NAO_COMPARECIMENTO",

              }
            );

          }


          // --------------------------------------------------
          // HISTÓRICO DA VISITA
          // --------------------------------------------------

          await registrarEvento({

            leadId,

            tipo:
              "VISITA",

            usuario:
              usuarioAtual.nome,

            descricao:
              `${usuarioAtual.nome} registrou que o cliente não compareceu à visita.`,

            dados: {

              visitaId:
                visita.id,

              data:
                visita.data || "",

              hora:
                visita.hora || "",

              comparecimento:
                "NAO_COMPARECEU",

              atendidoPor:
                usuarioAtual.uid,

              atendidoPorNome:
                usuarioAtual.nome,

              pendencia:
                "NOVO_CONTATO_NAO_COMPARECIMENTO",

            },

          });


          // --------------------------------------------------
          // PENDÊNCIA
          // --------------------------------------------------

          await registrarEvento({

            leadId,

            tipo:
              "PENDENCIA",

            usuario:
              usuarioAtual.nome,

            descricao:
              "Lead precisa de novo contato para entender o motivo da ausência e tentar reagendar a visita.",

            dados: {

              motivo:
                "NAO_COMPARECEU",

              visitaId:
                visita.id,

              acao:
                "NOVO_CONTATO",

              responsavel:
                usuarioAtual.uid,

              responsavelNome:
                usuarioAtual.nome,

            },

          });

        }

      }


      // ======================================================
      // ABRE OBSERVAÇÃO
      // ======================================================

      setModoComparecimento(true);

    } catch (erro) {

      console.error(
        "Erro ao registrar comparecimento:",
        erro
      );

      alert(
        "Não foi possível registrar o comparecimento."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // SALVAR OBSERVAÇÃO
  // ==========================================================

  async function salvarObservacao() {

    if (!usuarioAtual.uid) {

      alert(
        "Não foi possível identificar o usuário logado."
      );

      return;

    }


    try {

      setSalvando(true);


      const visitaAtualizada =
        await atualizarVisita(
          visita.id,
          {

            observacao,

            ultimaObservacaoPor:
              usuarioAtual.uid,

            ultimaObservacaoPorNome:
              usuarioAtual.nome,

            ultimaObservacaoEm:
              new Date(),

          }
        );


      if (onAtualizar) {

        onAtualizar({

          ...visita,

          ...visitaAtualizada,

          observacao,

        });

      }


      // ======================================================
      // HISTÓRICO DA OBSERVAÇÃO
      // ======================================================

      const leadId =
        lead?.id ||
        visita.leadId;


      if (leadId) {

        await registrarEvento({

          leadId,

          tipo:
            "VISITA_OBSERVACAO",

          usuario:
            usuarioAtual.nome,

          descricao:
            `${usuarioAtual.nome} adicionou uma observação à visita.`,

          dados: {

            visitaId:
              visita.id,

            observacao,

            usuarioId:
              usuarioAtual.uid,

            usuarioNome:
              usuarioAtual.nome,

          },

        });

      }


      setModoObservacao(false);

      setModoComparecimento(false);

    } catch (erro) {

      console.error(
        "Erro ao salvar observação:",
        erro
      );

      alert(
        "Não foi possível salvar a observação."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // REAGENDAR (visita + espelho do lead + Timeline, num lote atômico)
  // ==========================================================

  async function reagendarVisita() {

    if (reagendandoRef.current) {
      return;
    }

    if (!data || !hora) {

      alert(
        "Informe a nova data e o novo horário."
      );

      return;

    }


    reagendandoRef.current = true;

    try {

      setSalvando(true);


      // ATENÇÃO — não incluir confirmadoPor/confirmadoPorNome/
      // confirmadoEm aqui. As Rules (autoriaValida) só aceitam
      // gravar esses 3 campos com o valor do próprio chamador
      // (nunca null) quando eles estão sendo alterados — numa
      // visita já confirmada antes (ex.: NAO_COMPARECEU depois
      // de confirmada), tentar zerá-los faz o updateDoc inteiro
      // ser negado (permission-denied), e o reagendamento nunca
      // termina. status:"AGENDADA" já é suficiente para a UI
      // parar de mostrar a visita como confirmada (ver
      // visitaConfirmada abaixo e Calendario.jsx) — o valor
      // antigo de confirmadoPor* fica só como histórico, sem
      // efeito visual.
      // (O payload da visita, com essa restrição, vive agora em
      // reagendamentoAgenda.js — nunca inclui confirmadoPor*.)
      // Visita + espelho do lead + evento da Timeline gravados juntos,
      // num único lote atômico (ver reagendamentoAgenda.js): ou os três,
      // ou nenhum. Se as Rules negarem o lote, volta ao comportamento de
      // sempre (só a visita) e o resultado vem marcado como parcial.
      const resultado =
        await reagendamentoAgenda.reagendar({

          visita,

          lead,

          nova: {
            data,
            hora,
            observacao,
          },

          autor: {
            uid:
              usuarioAtual.uid,
            nome:
              usuarioAtual.nome,
          },

        });


      if (onAtualizar) {

        onAtualizar({

          ...visita,

          ...resultado.visita,

          data,

          hora,

          observacao,

          comparecimento:

            "",

          status:

            "AGENDADA",

        });

      }


      if (resultado.parcial) {

        alert(
          "A visita foi reagendada, mas o cadastro do lead e/ou o histórico do cliente não puderam ser atualizados. Avise o suporte."
        );

      }


      setModoReagendar(false);

      setModoComparecimento(false);

      setModoObservacao(false);

    } catch (erro) {

      console.error(
        "Erro ao reagendar visita:",
        erro
      );

      alert(
        "Não foi possível reagendar a visita."
      );

    } finally {

      reagendandoRef.current = false;

      setSalvando(false);

    }

  }


  // ==========================================================
  // DATA FORMATADA
  // ==========================================================

  function formatarData(data) {

    if (!data) {

      return "Não informada";

    }


    const partes =
      data.split("-");


    if (
      partes.length !== 3
    ) {

      return data;

    }


    return `${partes[2]}/${partes[1]}/${partes[0]}`;

  }


  // ==========================================================
  // STATUS
  // ==========================================================

  const visitaConfirmada =
    visita.status ===
      "CONFIRMADA" ||

    visita.status ===
      "confirmada" ||

    visita.status ===
      "Confirmada";


  const compareceu =
    visita.comparecimento ===
    "COMPARECEU";


  const naoCompareceu =
    visita.comparecimento ===
    "NAO_COMPARECEU";


  // ==========================================================
  // DADOS DO LEAD
  // ==========================================================

  const nomeLead =
    lead?.nome ||
    visita.leadNome ||
    "Lead";


  const telefone =
    lead?.telefone ||
    "Não informado";


  const idade =
    lead?.idade ||
    "Não informada";


  const objetivo =
    lead?.objetivo ||
    "Não informado";


  const observacaoFinal =
    visita.observacao ||
    lead?.observacao ||
    lead?.observacoes ||
    lead?.notas ||
    "Nenhuma observação registrada.";


  // ==========================================================
  // PERMISSÕES
  // ==========================================================

  const podeConfirmar =
    isAdmin ||
    isRecepcionista;


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="detalhesVisitaInline">


      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="detalhesVisitaHeader">

        <div>

          <span className="detalhesVisitaTag">
            📅 DETALHES DA VISITA
          </span>

          <h2>
            {nomeLead}
          </h2>

        </div>


        <button
          className="detalhesVisitaFechar"
          onClick={fechar}
          type="button"
        >
          ×
        </button>

      </div>


      {/* =====================================================
          STATUS
      ===================================================== */}

      <div
        className={`
          detalhesVisitaStatus
          ${
            visitaConfirmada
              ? "statusConfirmada"
              : "statusPendente"
          }
        `}
      >

        {visitaConfirmada
          ? "🟢 VISITA CONFIRMADA"
          : "🔴 AGUARDANDO CONFIRMAÇÃO"}

      </div>


      {/* =====================================================
          INFORMAÇÕES DA VISITA
      ===================================================== */}

      <div className="detalhesVisitaInfo">

        <div className="detalhesInfoItem">

          <span>
            🕐 Horário
          </span>

          <strong>
            {visita.hora || "--:--"}
          </strong>

        </div>


        <div className="detalhesInfoItem">

          <span>
            📅 Data
          </span>

          <strong>
            {formatarData(
              visita.data
            )}
          </strong>

        </div>


        <div className="detalhesInfoItem">

          <span>
            👩‍💼 Dono do Lead
          </span>

          <strong>
            {visita.consultora ||
              "Não informado"}
          </strong>

        </div>

      </div>


      {/* =====================================================
          CONFIRMAÇÃO
      ===================================================== */}

      {visitaConfirmada &&
        visita.confirmadoPorNome && (

          <div
            style={{
              marginTop: "15px",
              padding: "13px 15px",
              borderRadius: "11px",
              background: "#ecfdf5",
              border:
                "1px solid #bbf7d0",
              color: "#166534",
            }}
          >

            ✅ <strong>Confirmada por:</strong>{" "}

            {visita.confirmadoPorNome}

          </div>

        )}


      {/* =====================================================
          CLIENTE
      ===================================================== */}

      <div className="detalhesVisitaSecao">

        <h3>
          👤 Informações do cliente
        </h3>


        <div className="detalhesLeadDados">

          <p>
            📱 <strong>Telefone:</strong>{" "}
            <span className="detalhesTelefoneNumero">
              {telefone}
              <BotaoWhatsAppCliente
                telefone={lead?.telefone}
              />
            </span>
          </p>

          <p>
            🎂 <strong>Idade:</strong>{" "}
            {idade}
          </p>

          <p>
            🎯 <strong>Objetivo:</strong>{" "}
            {objetivo}
          </p>

        </div>

      </div>


      {/* =====================================================
          ALERTA
      ===================================================== */}

      {lead?.alertaNaoCompareceu && (

        <div
          style={{
            marginTop: "15px",
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#fff7d6",
            border: "1px solid #f0c36a",
            color: "#7a5600",
            fontWeight: "600",
          }}
        >

          🟡 <strong>ATENÇÃO:</strong>{" "}

          Este Lead não compareceu à visita.

          <div
            style={{
              marginTop: "5px",
              fontWeight: "500",
            }}
          >
            É necessário entrar em contato para
            entender o motivo e tentar reagendar.
          </div>

        </div>

      )}


      {/* =====================================================
          COMPARECIMENTO
      ===================================================== */}

      {visitaConfirmada && (

        <div className="detalhesVisitaSecao">

          <h3>
            👣 Comparecimento
          </h3>

          <p>
            Registre se o cliente compareceu à visita.
          </p>


          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "12px",
              flexWrap: "wrap",
            }}
          >

            <button
              type="button"
              onClick={() =>
                registrarComparecimento(
                  "COMPARECEU"
                )
              }
              disabled={salvando}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border:
                  compareceu
                    ? "2px solid #22c55e"
                    : "1px solid #ddd",
                background:
                  compareceu
                    ? "#ecfdf5"
                    : "#fff",
                cursor:
                  salvando
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              🟢 Compareceu
            </button>


            <button
              type="button"
              onClick={() =>
                registrarComparecimento(
                  "NAO_COMPARECEU"
                )
              }
              disabled={salvando}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border:
                  naoCompareceu
                    ? "2px solid #ef4444"
                    : "1px solid #ddd",
                background:
                  naoCompareceu
                    ? "#fef2f2"
                    : "#fff",
                cursor:
                  salvando
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "700",
                fontSize: "14px",
              }}
            >
              🔴 Não compareceu
            </button>

          </div>


          {/* =================================================
              OBSERVAÇÃO DO COMPARECIMENTO
          ================================================= */}

          {modoComparecimento && (

            <div
              style={{
                marginTop: "15px",
              }}
            >

              <label>
                📝 Observação
              </label>

              <textarea
                className="detalhesObservacaoInput"
                value={observacao}
                onChange={(evento) =>
                  setObservacao(
                    evento.target.value
                  )
                }
                placeholder={
                  compareceu
                    ? "Ex.: Compareceu, gostou do plano e vai voltar amanhã com a esposa..."
                    : "Ex.: Não compareceu. Entrar em contato para reagendar..."
                }
                rows={4}
              />


              <button
                type="button"
                className="btnConfirmarVisita"
                onClick={
                  salvarObservacao
                }
                disabled={salvando}
                style={{
                  marginTop: "10px",
                }}
              >

                {salvando
                  ? "Salvando..."
                  : "💾 Salvar observação"}

              </button>

            </div>

          )}

        </div>

      )}


      {/* =====================================================
          HISTÓRICO DO CLIENTE
          (reaproveita a Timeline do lead — não cria outro histórico)
      ===================================================== */}

      {(visita.leadId || lead?.id) && (

        <div className="detalhesVisitaSecao detalhesHistorico">

          <button
            type="button"
            className={
              historicoAberto
                ? "abaHistorico abaHistoricoAtiva"
                : "abaHistorico"
            }
            aria-expanded={historicoAberto}
            onClick={() =>
              setHistoricoAberto(
                (aberto) => !aberto
              )
            }
          >
            📜 Histórico
          </button>

          {historicoAberto && (

            <div className="detalhesHistoricoCorpo">

              <LeadTimeline
                lead={
                  lead ||
                  { id: visita.leadId }
                }
              />

            </div>

          )}

        </div>

      )}


      {/* =====================================================
          ATENDIMENTO
      ===================================================== */}

      {visita.atendidoPorNome && (

        <div
          style={{
            marginTop: "15px",
            padding: "13px 15px",
            borderRadius: "11px",
            background: "#eff6ff",
            border:
              "1px solid #bfdbfe",
            color: "#1e40af",
          }}
        >

          🤝 <strong>Atendido por:</strong>{" "}

          {visita.atendidoPorNome}

        </div>

      )}


      {/* =====================================================
          OBSERVAÇÕES
      ===================================================== */}

      {!modoComparecimento && (

        <div className="detalhesVisitaSecao">

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >

            <h3>
              📝 O que foi conversado com o cliente
            </h3>


            <button
              type="button"
              onClick={() =>
                setModoObservacao(true)
              }
              disabled={salvando}
              style={{
                border: "none",
                borderRadius: "9px",
                padding: "8px 12px",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: "700",
                cursor:
                  salvando
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              ✏️ Editar
            </button>

          </div>


          {modoObservacao ? (

            <div
              style={{
                marginTop: "12px",
              }}
            >

              <textarea
                className="detalhesObservacaoInput"
                value={observacao}
                onChange={(evento) =>
                  setObservacao(
                    evento.target.value
                  )
                }
                placeholder="Digite a observação do atendimento..."
                rows={5}
              />


              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >

                <button
                  type="button"
                  className="btnConfirmarVisita"
                  onClick={
                    salvarObservacao
                  }
                  disabled={salvando}
                >
                  {salvando
                    ? "Salvando..."
                    : "💾 Salvar observação"}
                </button>


                <button
                  type="button"
                  className="btnCancelarReagendamento"
                  onClick={() =>
                    setModoObservacao(false)
                  }
                  disabled={salvando}
                >
                  Cancelar
                </button>

              </div>

            </div>

          ) : (

            <div className="detalhesObservacao">

              {observacaoFinal}

            </div>

          )}

        </div>

      )}


      {/* =====================================================
          REAGENDAMENTO
      ===================================================== */}

      {modoReagendar && (

        <div className="detalhesVisitaSecao">

          <h3>
            🔄 Novo horário
          </h3>


          <div className="reagendamentoCampos">

            <div>

              <label>
                Data
              </label>

              <input
                type="date"
                value={data}
                onChange={(evento) =>
                  setData(
                    evento.target.value
                  )
                }
              />

            </div>


            <div>

              <label>
                Horário
              </label>

              <input
                type="time"
                value={hora}
                onChange={(evento) =>
                  setHora(
                    evento.target.value
                  )
                }
              />

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          BOTÕES
      ===================================================== */}

      <div className="detalhesVisitaActions">


        {/* ---------------------------------------------------
            CONFIRMAR
        --------------------------------------------------- */}

        {!modoReagendar &&
          !visitaConfirmada &&
          podeConfirmar && (

            <button
              type="button"
              className="btnConfirmarVisita"
              onClick={
                confirmarVisita
              }
              disabled={salvando}
            >

              {salvando
                ? "Salvando..."
                : "✅ Confirmar visita"}

            </button>

          )}


        {/* ---------------------------------------------------
            REAGENDAR
        --------------------------------------------------- */}

        {!modoReagendar && (

          <button
            type="button"
            className="btnReagendarVisita"
            onClick={() =>
              setModoReagendar(true)
            }
            disabled={salvando}
          >
            🔄 Reagendar
          </button>

        )}


        {modoReagendar && (

          <>

            <button
              type="button"
              className="btnCancelarReagendamento"
              onClick={() =>
                setModoReagendar(false)
              }
              disabled={salvando}
            >
              Cancelar
            </button>


            <button
              type="button"
              className="btnConfirmarVisita"
              onClick={
                reagendarVisita
              }
              disabled={salvando}
            >

              {salvando
                ? "Salvando..."
                : "💾 Salvar novo horário"}

            </button>

          </>

        )}


        {/* ---------------------------------------------------
            FECHAR
        --------------------------------------------------- */}

        <button
          type="button"
          className="btnFecharDetalhes"
          onClick={fechar}
        >
          Fechar detalhes
        </button>

      </div>

      <ConfirmarVisitaWhatsAppModal

        aberto={modoConfirmarWhatsApp}

        fechar={() =>
          setModoConfirmarWhatsApp(false)
        }

        leadId={
          lead?.id ||
          visita.leadId
        }

        visitaId={
          visita.id
        }

        nomeLead={
          lead?.nome ||
          visita.leadNome ||
          ""
        }

        nomeRecepcionista={
          usuarioAtual.nome
        }

        horario={
          visita.hora || ""
        }

        telefone={
          lead?.telefone
        }

      />

    </div>

  );

}
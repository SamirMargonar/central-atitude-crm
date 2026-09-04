import { useEffect, useState } from "react";

import "../styles/dashboard.css";
import "../styles/painelComercial.css";

import { ETAPAS } from "../core/LeadFlow";

import {
  buscarVisitasPorPerfil,
} from "../Agenda/VisitaEngine";

import LeadDetailsModal from "../components/LeadDetailsModal/LeadDetailsModal";

import RelatorioMatriculas from "./RelatorioMatriculas";

import FunilComercial from "./FunilComercial";
import IndicadoresPeriodo from "./IndicadoresPeriodo";
import PrecisaAtencao from "./PrecisaAtencao";
import WhatsAppLivreModal from "./WhatsAppLivreModal";

import {
  calcularIndicadores,
  calcularFunilComercial,
  calcularIntervaloPeriodo,
  filtrarLeadsPorPeriodo,
  filtrarVisitasPorPeriodo,
  filtrarNegociacoesParadas,
  filtrarRenovacoesProximas,
  filtrarLeadsSemResposta,
} from "../core/RelatoriosCalculos";

import {
  filtrarNaoCompareceram,
} from "../utils/naoCompareceramFilters";

import {
  useAuth,
} from "../auth/AuthContext";


export default function Dashboard({
  leads = [],
}) {

  const {
    isAdmin,
    isCoordenador,
    perfilUsuario,
  } = useAuth();

  // ==========================================================
  // V1.5 — separação por perfil
  //
  // Admin e coordenador veem o painel comercial completo
  // (Indicadores + Funil). Recepcionista vê só "Precisa da sua
  // atenção" e os cards operacionais já existentes. Reaproveita
  // isAdmin/isCoordenador do useAuth() já existente — nenhum
  // sistema de permissões novo, nenhuma alteração em
  // Permissions.js.
  // ==========================================================

  const podeVerPainelComercialAvancado =
    isAdmin || isCoordenador;

  const [visitas, setVisitas] =
    useState([]);

  const [carregando, setCarregando] =
    useState(true);

  const [leadSelecionado, setLeadSelecionado] =
    useState(null);

  const [whatsappAlvo, setWhatsappAlvo] =
    useState(null);

  const [mostrarVisitasHoje, setMostrarVisitasHoje] =
    useState(false);

  const [mostrarRelatorioMatriculas, setMostrarRelatorioMatriculas] =
    useState(false);

  const [periodoSelecionado, setPeriodoSelecionado] =
    useState("HOJE");

  const [dataInicioPersonalizada, setDataInicioPersonalizada] =
    useState("");

  const [dataFimPersonalizada, setDataFimPersonalizada] =
    useState("");

  const [indicadoresAberto, setIndicadoresAberto] =
    useState(false);

  const [funilAberto, setFunilAberto] =
    useState(false);


  // ==========================================================
  // FUNÇÃO PADRÃO PARA IDENTIFICAR A ETAPA
  // ==========================================================

  function obterEtapa(lead) {

    return Number(
      lead?.etapa ?? ETAPAS.RECEBIDO
    );

  }


  // ==========================================================
  // CARREGAR VISITAS
  // ==========================================================

  useEffect(() => {

    async function carregar() {

      try {

        // ------------------------------------------------------
        // Admin/coordenador: consulta ampla (igual a antes).
        // Recepcionista: consulta já vem pré-filtrada pelo
        // próprio turno (horaEntrada/horaSaida), independente
        // de quem é o responsável pelo Lead.
        // ------------------------------------------------------

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

        setVisitas(resultado);

      } catch (erro) {

        console.error(
          "Erro ao carregar visitas:",
          erro
        );

      } finally {

        setCarregando(false);

      }

    }

    carregar();

  }, [
    isAdmin,
    perfilUsuario,
  ]);


  // ==========================================================
  // ABRIR LEAD DA VISITA
  // ==========================================================

  function abrirLeadDaVisita(visita) {

    if (!visita?.leadId) {

      alert(
        "Esta visita não possui um Lead vinculado."
      );

      return;

    }


    const leadEncontrado =
      leads.find(
        (lead) =>
          lead.id === visita.leadId
      );


    if (!leadEncontrado) {

      alert(
        "Não foi possível encontrar os dados deste Lead."
      );

      return;

    }


    setLeadSelecionado(
      leadEncontrado
    );

  }


  // ==========================================================
  // ABRIR LEAD PELO ID (usado pela seção "Precisa da sua
  // atenção", cujos itens já vêm normalizados com leadId)
  // ==========================================================

  function abrirLeadPorId(leadId) {

    if (!leadId) {

      alert(
        "Não foi possível identificar o Lead."
      );

      return;

    }

    const leadEncontrado =
      leads.find(
        (lead) =>
          lead.id === leadId
      );

    if (!leadEncontrado) {

      alert(
        "Não foi possível encontrar os dados deste Lead."
      );

      return;

    }

    setLeadSelecionado(
      leadEncontrado
    );

  }


  // ==========================================================
  // IR PARA NÃO COMPARECIDOS
  // ==========================================================

  function irParaNaoComparecidos() {

    const elemento =
      document.getElementById(
        "nao-comparecidos"
      );


    if (elemento) {

      elemento.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

    }

  }


  // ==========================================================
  // DATA DE HOJE
  // ==========================================================

  const hoje =
    new Date();


  const hojeString =
    `${hoje.getFullYear()}-${String(
      hoje.getMonth() + 1
    ).padStart(2, "0")}-${String(
      hoje.getDate()
    ).padStart(2, "0")}`;


  // ==========================================================
  // VISITAS DE HOJE
  // ==========================================================

  const visitasHoje =
    visitas.filter(
      (visita) =>
        visita.data === hojeString
    );


  // ==========================================================
  // NÃO COMPARECIDOS
  // ==========================================================

  const naoComparecidos =
    visitas.filter(
      (visita) =>
        visita.comparecimento ===
        "NAO_COMPARECEU" &&
        visita.data ===
        hojeString
    );


  // ==========================================================
  // CONTADORES
  // ==========================================================

  const leadsRecebidos =
    leads.filter((lead) => {

      const etapa =
        obterEtapa(lead);

      return (
        !lead.assumido &&
        etapa === ETAPAS.RECEBIDO
      );

    });


  // ==========================================================
  // EM ATENDIMENTO
  //
  // Matrícula NÃO entra aqui.
  // ==========================================================

  const emAtendimento =
    leads.filter((lead) => {

      const etapa =
        obterEtapa(lead);

      return (
        lead.assumido &&
        etapa !== ETAPAS.MATRICULA
      );

    });


  // ==========================================================
  // MATRÍCULAS
  //
  // IMPORTANTE:
  // Usamos Number() para funcionar tanto com:
  //
  // etapa: 4
  //
  // quanto:
  //
  // etapa: "4"
  // ==========================================================

  const matriculas =
    leads.filter((lead) => {

      const etapa =
        obterEtapa(lead);

      return (
        etapa === ETAPAS.MATRICULA
      );

    });


  // ==========================================================
  // LEADS HÁ MAIS DE 24 HORAS
  // SEM SEREM ASSUMIDOS
  // ==========================================================

  const agora =
    Date.now();


  const leadsAtrasados =
    leads.filter((lead) => {

      if (lead.assumido) {
        return false;
      }


      if (!lead.createdAt?.seconds) {
        return false;
      }


      const criadoEm =
        lead.createdAt.seconds * 1000;


      const horas =
        (agora - criadoEm) /
        (1000 * 60 * 60);


      return horas >= 24;

    });


  // ==========================================================
  // FORMATAR DATA
  // ==========================================================

  function formatarData(data) {

    if (!data) {
      return "--/--/----";
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
  // V1.5 — PAINEL COMERCIAL
  // ==========================================================
  //
  // Funil e Indicadores respeitam o período selecionado.
  // "Precisa da sua atenção" é sempre independente do período
  // (mostra pendências reais, não recortadas por data).
  //
  // Nenhuma consulta nova ao Firestore: tudo abaixo deriva de
  // `leads` (prop) e `visitas` (já carregado acima neste mesmo
  // componente).
  // ==========================================================

  const intervaloPeriodo =
    periodoSelecionado === "PERSONALIZADO"
      ? {
          dataInicio: dataInicioPersonalizada,
          dataFim: dataFimPersonalizada,
        }
      : calcularIntervaloPeriodo(
          periodoSelecionado,
          new Date()
        );


  const { dentro: leadsNoPeriodo } =
    filtrarLeadsPorPeriodo(
      leads,
      intervaloPeriodo.dataInicio || null,
      intervaloPeriodo.dataFim || null
    );


  const visitasNoPeriodo =
    filtrarVisitasPorPeriodo(
      visitas,
      intervaloPeriodo.dataInicio || null,
      intervaloPeriodo.dataFim || null
    );


  const indicadoresPeriodo =
    calcularIndicadores(
      leadsNoPeriodo,
      visitasNoPeriodo
    );


  const funilComercial =
    calcularFunilComercial(
      leadsNoPeriodo,
      visitasNoPeriodo
    );


  // ----------------------------------------------------------
  // "PRECISA DA SUA ATENÇÃO" — sempre sobre `leads`/`visitas`
  // completos, nunca sobre o recorte de período.
  // ----------------------------------------------------------

  const negociacoesParadas =
    filtrarNegociacoesParadas(
      leads,
      new Date(),
      3
    );


  const renovacoesProximas =
    filtrarRenovacoesProximas(
      leads,
      60,
      new Date()
    );


  const naoComparecidosPendentes =
    filtrarNaoCompareceram(visitas);


  const leadsSemResposta =
    filtrarLeadsSemResposta(leads);


  const categoriasAtencao = [

    {

      titulo: "Sem atendimento",

      icone: "🆕",

      itens:
        leadsRecebidos.map(
          (lead) => ({

            id: lead.id,

            leadId: lead.id,

            nome:
              lead.nome || "Lead",

            telefone:
              lead.telefone,

            subtitulo:
              "Aguardando atendimento",

          })
        ),

    },

    {

      titulo: "Sem resposta",

      icone: "📵",

      itens:
        leadsSemResposta.map(
          (lead) => ({

            id: lead.id,

            leadId: lead.id,

            nome:
              lead.nome || "Lead",

            telefone:
              lead.telefone,

            subtitulo:
              `${Number(lead.tentativasSemResposta || 0)} tentativa(s) sem resposta`,

          })
        ),

    },

    {

      titulo: "Não compareceram",

      icone: "🔴",

      itens:
        naoComparecidosPendentes.map(
          (visita) => {

            const lead =
              leads.find(
                (item) =>
                  item.id === visita.leadId
              );

            return {

              id: visita.id,

              leadId: visita.leadId,

              nome:
                visita.leadNome ||
                lead?.nome ||
                "Lead",

              telefone:
                lead?.telefone,

              subtitulo:
                `Visita ${formatarData(visita.data)} às ${visita.hora || "--:--"}`,

            };

          }
        ),

    },

    {

      titulo: "Negociação parada",

      icone: "🟡",

      itens:
        negociacoesParadas.map(
          (lead) => ({

            id: lead.id,

            leadId: lead.id,

            nome:
              lead.nome || "Lead",

            telefone:
              lead.telefone,

            subtitulo:
              "Sem movimento há 3 dias ou mais",

          })
        ),

    },

    {

      titulo: "Renovação próxima",

      icone: "🔄",

      itens:
        renovacoesProximas.map(
          (lead) => ({

            id: lead.id,

            leadId: lead.id,

            nome:
              lead.nome || "Lead",

            telefone:
              lead.telefone,

            subtitulo:
              `Vence em ${formatarData(lead.matricula?.dataVencimento)}`,

          })
        ),

    },

  ];


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      {/* ======================================================
          CABEÇALHO
      ====================================================== */}

      <section className="dashboardTitulo">

        <div>

          <h1>
            🏠 Painel de Controle
          </h1>

          <p>
            Visão geral da operação comercial.
          </p>

        </div>

      </section>


      {/* ======================================================
          V1.5 — PAINEL COMERCIAL
      ====================================================== */}

      <PrecisaAtencao
        categorias={categoriasAtencao}
        onAbrirLead={abrirLeadPorId}
      />

      {podeVerPainelComercialAvancado && (

        <>

          <IndicadoresPeriodo
            indicadores={indicadoresPeriodo}
            periodoSelecionado={periodoSelecionado}
            onMudarPeriodo={setPeriodoSelecionado}
            dataInicioPersonalizada={dataInicioPersonalizada}
            dataFimPersonalizada={dataFimPersonalizada}
            onMudarDataInicioPersonalizada={setDataInicioPersonalizada}
            onMudarDataFimPersonalizada={setDataFimPersonalizada}
            aberto={indicadoresAberto}
            onAlternar={() =>
              setIndicadoresAberto(
                (valor) => !valor
              )
            }
          />

          <FunilComercial
            funil={funilComercial}
            aberto={funilAberto}
            onAlternar={() =>
              setFunilAberto(
                (valor) => !valor
              )
            }
          />

        </>

      )}


      {/* ======================================================
          ALERTA DE NÃO COMPARECIDOS
      ====================================================== */}

      {naoComparecidos.length > 0 && (

        <section
          className="dashboardBloco"
          id="nao-comparecidos"
          style={{
            border:
              "2px solid #ef4444",
            marginBottom:
              "20px",
          }}
        >

          <div
            className="dashboardBlocoHeader"
            style={{
              background:
                "#fef2f2",
              borderRadius:
                "12px",
            }}
          >

            <div>

              <h2
                style={{
                  color:
                    "#dc2626",
                  marginBottom:
                    "5px",
                }}
              >
                🔴 Atenção — Leads que não compareceram
              </h2>

              <p>
                Estes clientes não compareceram à visita
                e precisam de contato para entender o motivo
                e tentar reagendar.
              </p>

            </div>


            <strong
              style={{
                color:
                  "#dc2626",
              }}
            >
              {naoComparecidos.length}
            </strong>

          </div>


          <div className="listaAlertas">

            {naoComparecidos.map((visita) => {

              const lead =
                leads.find(
                  (item) =>
                    item.id ===
                    visita.leadId
                );


              const nome =
                visita.leadNome ||
                lead?.nome ||
                "Lead";


              const consultora =
                visita.consultora ||
                "Samir";


              return (

                <div
                  className="alertaLead"
                  key={visita.id}
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap:
                      "15px",
                    flexWrap:
                      "wrap",
                    border:
                      "1px solid #fecaca",
                    background:
                      "#fff",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "5px",
                    }}
                  >

                    <strong
                      style={{
                        fontSize:
                          "16px",
                      }}
                    >
                      🔴 {nome}
                    </strong>


                    <span>
                      📅 Visita:{" "}
                      {formatarData(
                        visita.data
                      )}
                      {" "}
                      às{" "}
                      {visita.hora ||
                        "--:--"}
                    </span>


                    <span>
                      👩‍💼 Consultora:{" "}
                      {consultora}
                    </span>


                    <span
                      style={{
                        color:
                          "#dc2626",
                        fontWeight:
                          "600",
                      }}
                    >
                      ⚠️ Não compareceu.
                      Entrar em contato para
                      entender o motivo e tentar
                      reagendar.
                    </span>

                  </div>


                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap:
                        "8px",
                      flexWrap:
                        "wrap",
                    }}
                  >

                    <button
                      type="button"
                      className="abrirLeadDashboard"
                      onClick={() =>
                        abrirLeadDaVisita(
                          visita
                        )
                      }
                      style={{
                        border:
                          "none",
                        cursor:
                          "pointer",
                        padding:
                          "6px 10px",
                        borderRadius:
                          "8px",
                        fontSize:
                          "12px",
                        fontWeight:
                          "700",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      👁️ Ver histórico →
                    </button>

                    {lead?.telefone && (

                      <button
                        type="button"
                        className="precisaAtencaoWhatsApp"
                        onClick={() =>
                          setWhatsappAlvo({

                            leadId:
                              visita.leadId,

                            nome,

                            telefone:
                              lead.telefone,

                          })
                        }
                      >
                        💬 WhatsApp
                      </button>

                    )}

                  </div>

                </div>

              );

            })}

          </div>

        </section>

      )}


      {/* ======================================================
          CARDS PRINCIPAIS
      ====================================================== */}

      <section className="dashboard">


        {/* VISITAS HOJE */}

        <button
          type="button"
          className={`
            cardDashboard
            cardDashboardClicavel
            ${
              mostrarVisitasHoje
                ? "cardDashboardAtivo"
                : ""
            }
          `}
          onClick={() =>
            setMostrarVisitasHoje(
              !mostrarVisitasHoje
            )
          }
        >

          <h3>
            📅 Visitas Hoje
          </h3>

          <span className="numero">
            {visitasHoje.length}
          </span>

          <p>
            {mostrarVisitasHoje
              ? "Clique para ocultar"
              : "Clique para ver as visitas"}
          </p>

        </button>


        {/* AGUARDANDO ATENDIMENTO */}

        <div className="cardDashboard">

          <h3>
            🆕 Aguardando Atendimento
          </h3>

          <span className="numero">
            {leadsRecebidos.length}
          </span>

          <p>
            Leads aguardando recepção
          </p>

        </div>


        {/* EM ATENDIMENTO */}

        <div className="cardDashboard">

          <h3>
            🤝 Em Atendimento
          </h3>

          <span className="numero">
            {emAtendimento.length}
          </span>

          <p>
            Leads em andamento
          </p>

        </div>


        {/* MATRÍCULAS */}

        <button
          type="button"
          className="cardDashboard cardDashboardClicavel"
          onClick={() =>
            setMostrarRelatorioMatriculas(true)
          }
        >

          <h3>
            🎓 Matrículas
          </h3>

          <span className="numero">
            {matriculas.length}
          </span>

          <p>
            Clique para ver o relatório
          </p>

        </button>


        {/* NÃO COMPARECIDOS */}

        <button
          type="button"
          className={`
            cardDashboard
            cardDashboardClicavel
            ${
              naoComparecidos.length > 0
                ? "cardDashboardNaoComparecido"
                : ""
            }
          `}
          onClick={
            irParaNaoComparecidos
          }
          style={{
            borderTop:
              "3px solid #ef4444",
          }}
        >

          <h3>
            🔴 Não Comparecidos
          </h3>

          <span
            className="numero"
            style={{
              color:
                naoComparecidos.length > 0
                  ? "#ef4444"
                  : undefined,
            }}
          >
            {naoComparecidos.length}
          </span>

          <p>
            {naoComparecidos.length > 0
              ? "Clique para ver e contatar"
              : "Nenhum pendente"}
          </p>

        </button>

      </section>


      {/* ======================================================
          ALERTA DE LEADS ESQUECIDOS
      ====================================================== */}

      <section className="dashboardBloco">

        <div className="dashboardBlocoHeader">

          <div>

            <h2>
              ⚠️ Atenção
            </h2>

            <p>
              Leads aguardando atendimento há
              mais de 24 horas.
            </p>

          </div>


          <strong>
            {leadsAtrasados.length}
          </strong>

        </div>


        {leadsAtrasados.length === 0 ? (

          <div className="dashboardVazio">

            ✅ Nenhum Lead atrasado.

          </div>

        ) : (

          <div className="listaAlertas">

            {leadsAtrasados
              .slice(0, 5)
              .map((lead) => (

                <div
                  className="alertaLead"
                  key={lead.id}
                >

                  <strong>
                    {lead.nome}
                  </strong>

                  <span>
                    📞 {lead.telefone}
                  </span>

                </div>

              ))}

          </div>

        )}

      </section>


      {/* ======================================================
          VISITAS DE HOJE
      ====================================================== */}

      {mostrarVisitasHoje && (

        <section
          className="dashboardBloco"
          id="visitas-hoje"
        >

          <div className="dashboardBlocoHeader">

            <div>

              <h2>
                📅 Visitas de Hoje
              </h2>

              <p>
                Clique em uma visita para abrir
                o histórico completo do Lead.
              </p>

            </div>


            <strong>
              {visitasHoje.length}
            </strong>

          </div>


          {carregando ? (

            <div className="dashboardVazio">

              ⏳ Carregando visitas...

            </div>

          ) : visitasHoje.length === 0 ? (

            <div className="dashboardVazio">

              📅 Nenhuma visita agendada para hoje.

            </div>

          ) : (

            <div className="listaVisitasDashboard">

              {[...visitasHoje]

                .sort((a, b) =>
                  (a.hora || "")
                    .localeCompare(
                      b.hora || ""
                    )
                )

                .map((visita) => {

                  const lead =
                    leads.find(
                      (item) =>
                        item.id ===
                        visita.leadId
                    );


                  const compareceu =
                    visita.comparecimento ===
                    "COMPARECEU";


                  const naoCompareceu =
                    visita.comparecimento ===
                    "NAO_COMPARECEU";


                  return (

                    <button
                      type="button"
                      className={`
                        visitaDashboard
                        ${
                          compareceu
                            ? "visitaDashboardCompareceu"
                            : ""
                        }
                        ${
                          naoCompareceu
                            ? "visitaDashboardNaoCompareceu"
                            : ""
                        }
                      `}
                      key={visita.id}
                      onClick={() =>
                        abrirLeadDaVisita(
                          visita
                        )
                      }
                    >

                      <div className="horaDashboard">

                        🕐 {visita.hora}

                      </div>


                      <div>

                        <strong>

                          {
                            visita.leadNome ||
                            lead?.nome ||
                            "Lead"
                          }

                        </strong>

                        <p>
                          👤{" "}
                          {visita.consultora ||
                            "Samir"}
                        </p>

                      </div>


                      <div>

                        {compareceu ? (

                          <span>
                            🟢 Compareceu
                          </span>

                        ) : naoCompareceu ? (

                          <span>
                            🔴 Não compareceu
                          </span>

                        ) : visita.status ===
                          "CONFIRMADA" ? (

                          <span>
                            🟢 Visita confirmada
                          </span>

                        ) : (

                          <span>
                            🔴 Aguardando confirmação
                          </span>

                        )}

                      </div>


                      {visita.observacao && (

                        <span>

                          📝{" "}
                          {visita.observacao}

                        </span>

                      )}


                      <span
                        className="abrirLeadDashboard"
                      >

                        👁️ Ver histórico do Lead →

                      </span>

                    </button>

                  );

                })}

            </div>

          )}

        </section>

      )}


      {/* ======================================================
          MODAL DO LEAD
      ====================================================== */}

      {leadSelecionado && (

        <LeadDetailsModal

          lead={
            leadSelecionado
          }

          onClose={() =>
            setLeadSelecionado(null)
          }

        />

      )}


      {/* ======================================================
          RELATÓRIO DE MATRÍCULAS
      ====================================================== */}

      <RelatorioMatriculas

        leads={leads}

        aberto={
          mostrarRelatorioMatriculas
        }

        fechar={() =>
          setMostrarRelatorioMatriculas(false)
        }

      />


      {/* ======================================================
          WHATSAPP LIVRE
      ====================================================== */}

      <WhatsAppLivreModal

        aberto={
          !!whatsappAlvo
        }

        fechar={() =>
          setWhatsappAlvo(null)
        }

        leadId={
          whatsappAlvo?.leadId
        }

        nome={
          whatsappAlvo?.nome
        }

        telefone={
          whatsappAlvo?.telefone
        }

      />

    </>

  );

}
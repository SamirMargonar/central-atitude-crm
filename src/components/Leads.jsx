import {
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import {
  useEffect,
  useState,
} from "react";

import {
  db,
} from "../firebase/firebase";

import {
  useAuth,
} from "../auth/AuthContext";

import LeadDetailsModal
  from "./LeadDetailsModal/LeadDetailsModal";

import LeadBoard
  from "./Lead/LeadBoard";

import FiltersBar
  from "./Filters/FiltersBar";

import WhatsAppLivreModal
  from "./WhatsAppLivreModal";

import {
  filtrarLeads,
} from "../utils/leadFilters";

import {
  filtrarNaoCompareceram,
} from "../utils/naoCompareceramFilters";

import {
  buscarVisitasPorPerfil,
} from "../Agenda/VisitaEngine";

import {
  ETAPAS,
  JORNADA,
} from "../core/LeadFlow";

import "../styles/leadsNaoCompareceram.css";


export default function Leads({
  leads = [],
}) {


  // ==========================================================
  // USUÁRIO LOGADO
  // ==========================================================

  const {
    isAdmin,
    perfilUsuario,
  } = useAuth();


  // ==========================================================
  // VISITAS (fonte da verdade do "Não Compareceram")
  // ==========================================================

  const [visitas, setVisitas] =
    useState([]);

  useEffect(() => {

    let ativo = true;

    async function carregar() {

      try {

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

        if (ativo) {

          setVisitas(resultado);

        }

      } catch (erro) {

        console.error(
          "Erro ao carregar visitas:",
          erro
        );

        if (ativo) {

          setVisitas([]);

        }

      }

    }

    carregar();

    return () => {

      ativo = false;

    };

  }, [isAdmin, perfilUsuario]);


  const naoCompareceram =
    filtrarNaoCompareceram(visitas);


  // ==========================================================
  // ABRE O LEAD A PARTIR DE UMA VISITA
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

    setLeadDetalhes(leadEncontrado);

  }


  // ==========================================================
  // FORMATA A DATA DA VISITA (aaaa-mm-dd -> dd/mm/aaaa)
  // ==========================================================

  function formatarDataVisita(data) {

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
  // MÊS ATUAL
  // ==========================================================

  function obterMesAtual() {

    const agora =
      new Date();


    const ano =
      agora.getFullYear();


    const mes =
      String(
        agora.getMonth() + 1
      ).padStart(
        2,
        "0"
      );


    return `${ano}-${mes}`;

  }


  // ==========================================================
  // LEAD SELECIONADO
  // ==========================================================

  const [
    leadDetalhes,
    setLeadDetalhes,
  ] = useState(null);

  const [
    whatsappAlvo,
    setWhatsappAlvo,
  ] = useState(null);


  // ==========================================================
  // FILTROS
  // ==========================================================

  const [
    filtros,
    setFiltros,
  ] = useState({

    pesquisa:
      "",

    consultora:
      "Todas",

    origem:
      "Todas",

    status:
      "Todos",

    objetivo:
      "Todos",

    mes:
      obterMesAtual(),

  });


  // ==========================================================
  // LEAD ATUALIZADO
  // ==========================================================

  const leadAtualizado =
    leadDetalhes

      ? leads.find(
          (lead) =>
            lead.id ===
            leadDetalhes.id
        )

      : null;


  // ==========================================================
  // ASSUMIR LEAD
  //
  // IMPORTANTE:
  //
  // Não existe mais:
  //
  // consultora: "Samir"
  //
  // O responsável será sempre o usuário que
  // estiver logado no momento em que clicar.
  // ==========================================================

  async function assumirLead(id) {

    const nomeUsuario =
      perfilUsuario?.nome ||
      "";


    const uidUsuario =
      perfilUsuario?.id ||
      "";


    // --------------------------------------------------------
    // GARANTE QUE SABEMOS QUEM ESTÁ LOGADO
    // --------------------------------------------------------

    if (!nomeUsuario) {

      alert(
        "Não foi possível identificar o usuário logado."
      );

      return;

    }


    try {

      // ======================================================
      // ATUALIZA LEAD
      // ======================================================

      await updateDoc(

        doc(
          db,
          "leads",
          id
        ),

        {

          // --------------------------------------------------
          // LEAD FOI ASSUMIDO
          // --------------------------------------------------

          assumido:
            true,


          // --------------------------------------------------
          // RESPONSÁVEL ATUAL
          // --------------------------------------------------

          responsavel:
            nomeUsuario,

          responsavelUid:
            uidUsuario,


          // --------------------------------------------------
          // MANTEMOS CONSULTORA SINCRONIZADA
          //
          // O useLeads usa esse campo para filtrar os
          // Leads de cada recepcionista.
          // --------------------------------------------------

          consultora:
            nomeUsuario,


          // --------------------------------------------------
          // QUEM ASSUMIU
          // --------------------------------------------------

          assumidoPor:
            nomeUsuario,

          assumidoPorUid:
            uidUsuario,


          // --------------------------------------------------
          // DATA/HORA DA ASSUNÇÃO
          // --------------------------------------------------

          assumidoEm:
            serverTimestamp(),

        }

      );


      console.log(
        `Lead ${id} assumido por ${nomeUsuario}.`
      );

    } catch (erro) {

      console.error(
        "Erro ao assumir Lead:",
        erro
      );

      alert(
        "Não foi possível assumir o Lead."
      );

    }

  }


  // ==========================================================
  // CONSULTORAS
  // ==========================================================

  const consultoras = [

    ...new Set(

      leads

        .map(
          (lead) =>
            lead.consultora
        )

        .filter(Boolean)

    ),

  ].sort();


  // ==========================================================
  // ORIGENS
  // ==========================================================

  const origens = [

    ...new Set(

      leads

        .map(
          (lead) =>
            lead.origem
        )

        .filter(Boolean)

    ),

  ].sort();


  // ==========================================================
  // OBJETIVOS
  // ==========================================================

  const objetivos = [

    ...new Set(

      leads

        .map(
          (lead) =>
            lead.objetivo
        )

        .filter(Boolean)

    ),

  ].sort();


  // ==========================================================
  // STATUS
  // ==========================================================

  const status =
    JORNADA.map(
      (etapa) =>
        etapa.nome
    );


  // ==========================================================
  // MESES
  // ÚLTIMOS 24 MESES
  // ==========================================================

  const meses = [];


  const agora =
    new Date();


  for (
    let i = 0;
    i < 24;
    i++
  ) {

    const data =
      new Date(

        agora.getFullYear(),

        agora.getMonth() - i,

        1

      );


    const ano =
      data.getFullYear();


    const numeroMes =
      String(
        data.getMonth() + 1
      ).padStart(
        2,
        "0"
      );


    const valor =
      `${ano}-${numeroMes}`;


    const label =
      data.toLocaleDateString(
        "pt-BR",
        {
          month:
            "long",

          year:
            "numeric",
        }
      );


    const labelFormatada =
      label.charAt(0).toUpperCase() +
      label.slice(1);


    meses.push({

      value:
        valor,

      label:
        labelFormatada,

    });

  }


  // ==========================================================
  // ORDENAÇÃO DAS ETAPAS
  // ==========================================================

  const ordemEtapas =
    Object.fromEntries(
      JORNADA.map(
        (etapa, indice) =>
          [etapa.id, indice]
      )
    );


  // ==========================================================
  // LEADS ORDENADOS
  // ==========================================================

  const leadsOrdenados =

    [...leads].sort(
      (a, b) => {

        const etapaA =
          a.etapa ??
          ETAPAS.RECEBIDO;


        const etapaB =
          b.etapa ??
          ETAPAS.RECEBIDO;


        const ordem =
          ordemEtapas[etapaA] -
          ordemEtapas[etapaB];


        if (
          ordem !== 0
        ) {

          return ordem;

        }


        const dataA =
          a.createdAt?.seconds ||
          0;


        const dataB =
          b.createdAt?.seconds ||
          0;


        return (
          dataB -
          dataA
        );

      }

    );


  // ==========================================================
  // APLICA FILTROS
  // ==========================================================

  const leadsFiltrados =

    filtrarLeads(

      leadsOrdenados,

      filtros

    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      {/* ====================================================
          MODAL DO LEAD
      ==================================================== */}

      <LeadDetailsModal

        lead={
          leadAtualizado
        }

        onClose={() =>
          setLeadDetalhes(null)
        }

      />


      {/* ====================================================
          WHATSAPP LIVRE
      ==================================================== */}

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


      {/* ====================================================
          PÁGINA DE LEADS
      ==================================================== */}

      <section
        className="leadsPagina"
      >


        {/* ==================================================
            CABEÇALHO
        ================================================== */}

        <div
          className="leadsPaginaCabecalho"
        >

          <div>

            <h1>
              👥 Leads
            </h1>


            <p>

              Acompanhe seus Leads em cada
              etapa da jornada comercial.

            </p>

          </div>


          <div
            className="totalLeads"
          >

            <strong>
              {
                leadsFiltrados.length
              }
            </strong>

            <span>
              Leads
            </span>

          </div>

        </div>


        {/* ==================================================
            FILTROS
        ================================================== */}

        <FiltersBar

          filtros={
            filtros
          }

          setFiltros={
            setFiltros
          }

          consultoras={
            consultoras
          }

          origens={
            origens
          }

          objetivos={
            objetivos
          }

          status={
            status
          }

          meses={
            meses
          }

        />


        {/* ==================================================
            NÃO COMPARECERAM
        ================================================== */}

        {naoCompareceram.length > 0 && (

          <section className="leadsAlertaNaoCompareceram">

            <div className="leadsAlertaCabecalho">

              <div>

                <h2>
                  🔴 Não Compareceram
                </h2>

                <p>
                  Estes leads não compareceram à visita agendada
                  e precisam de novo contato para reagendar.
                </p>

              </div>

              <strong>
                {naoCompareceram.length}
              </strong>

            </div>

            <div className="leadsAlertaLista">

              {naoCompareceram.map((visita) => {

                const lead =
                  leads.find(
                    (item) =>
                      item.id === visita.leadId
                  );

                const nome =
                  visita.leadNome ||
                  lead?.nome ||
                  "Lead";

                const consultora =
                  visita.consultora ||
                  "Não informado";

                return (

                  <div
                    className="leadsAlertaItem"
                    key={visita.id}
                  >

                    <div className="leadsAlertaInfo">

                      <strong>
                        🔴 {nome}
                      </strong>

                      <span>
                        📅 Visita: {formatarDataVisita(visita.data)}
                        {" "}às{" "}
                        {visita.hora || "--:--"}
                      </span>

                      <span>
                        👩‍💼 Consultora: {consultora}
                      </span>

                    </div>

                    <div className="leadsAlertaAcoes">

                      <button
                        type="button"
                        className="leadsAlertaBotao"
                        onClick={() =>
                          abrirLeadDaVisita(visita)
                        }
                      >
                        👁️ Ver histórico →
                      </button>

                      {lead?.telefone && (

                        <button
                          type="button"
                          className="leadsAlertaWhatsApp"
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


        {/* ==================================================
            QUADRO DE LEADS
        ================================================== */}

        <LeadBoard

          leads={
            leadsFiltrados
          }

          onAssumir={
            assumirLead
          }

          onVerHistorico={
            setLeadDetalhes
          }

        />

      </section>

    </>

  );

}
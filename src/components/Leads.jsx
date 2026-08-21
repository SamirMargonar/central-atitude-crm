import {
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import {
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

import {
  filtrarLeads,
} from "../utils/leadFilters";

import {
  ETAPAS,
  JORNADA,
} from "../core/LeadFlow";


export default function Leads({
  leads = [],
}) {


  // ==========================================================
  // USUÁRIO LOGADO
  // ==========================================================

  const {
    perfilUsuario,
  } = useAuth();


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
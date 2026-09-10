import { useEffect, useState } from "react";

import "../styles/dashboard.css";

import useLeads from "../../hooks/useLeads.js";

import {
  ETAPAS,
} from "../../core/LeadFlow.js";

import {
  filtrarLeadsSemAtendimento,
} from "../../core/RelatoriosCalculos.js";

import {
  buscarVisitasPorPerfil,
} from "../../Agenda/VisitaEngine.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";

import IndicadorCard from "../components/IndicadorCard.jsx";


// ==========================================================
// DASHBOARD — MOBILE (FASE 2 + FASE 2.1)
// ==========================================================
//
// Leads: useLeads() (hook existente, não alterado) — mesmo dado
// em tempo real, já filtrado por perfil/turno pelo próprio hook.
//
// "Aguardando Atendimento" reaproveita filtrarLeadsSemAtendimento()
// de core/RelatoriosCalculos.js — zero duplicação de regra.
//
// "Em Atendimento" e "Matrículas" replicam a MESMA condição de
// uma linha que o Dashboard.jsx do Desktop já usa inline (não
// existe uma função companheira em core/ pra essas duas sozinhas
// sem também exigir dados de visita).
//
// Visitas: buscarVisitasPorPerfil() (src/Agenda/VisitaEngine.js,
// NÃO alterado, só importado) — mesma função, mesmos parâmetros
// e mesma chamada que o Dashboard.jsx do Desktop já usa (isAdmin,
// perfil, horaEntrada, horaSaida — sem uid, exatamente como o
// Desktop chama). "Visitas Hoje" e "Não Comparecidos" replicam
// os mesmos dois filtros de uma linha que o Desktop já usa
// (visita.data === hoje / visita.comparecimento === "NAO_COMPARECEU"
// && data === hoje) — mesmo critério, não uma regra nova.
// ==========================================================

export default function DashboardScreen({
  usuario,
  perfilUsuario,
  onNavegar,
}) {

  const {
    leads,
  } = useLeads();


  const {
    isAdmin,
  } = useAuth();


  const nomeUsuario =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  function obterEtapa(lead) {

    return Number(
      lead?.etapa ??
      ETAPAS.RECEBIDO
    );

  }


  // ==========================================================
  // VISITAS — carregadas via a mesma função do Desktop
  // (buscarVisitasPorPerfil), uma única vez por sessão de perfil
  // (não é um listener em tempo real — a própria função também
  // não é, no Desktop tampouco).
  // ==========================================================

  const [visitas, setVisitas] =
    useState([]);

  const [carregandoVisitas, setCarregandoVisitas] =
    useState(true);


  useEffect(() => {

    let cancelado = false;


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


        if (!cancelado) {

          setVisitas(resultado);

        }

      } catch (erro) {

        console.error(
          "Erro ao carregar visitas (Mobile):",
          erro
        );

        if (!cancelado) {

          setVisitas([]);

        }

      } finally {

        if (!cancelado) {

          setCarregandoVisitas(false);

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
  // AGUARDANDO ATENDIMENTO — reaproveita core/RelatoriosCalculos.js
  // ==========================================================

  const aguardando =
    filtrarLeadsSemAtendimento(leads);


  // ==========================================================
  // EM ATENDIMENTO — mesma condição que Dashboard.jsx (Desktop)
  // já usa inline (Matrícula não entra)
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
  // MATRÍCULAS — mesma condição que Dashboard.jsx já usa inline
  // ==========================================================

  const matriculas =
    leads.filter(
      (lead) =>
        obterEtapa(lead) ===
        ETAPAS.MATRICULA
    );


  // ==========================================================
  // VISITAS HOJE / NÃO COMPARECIDOS — mesmos dois filtros de
  // uma linha que o Dashboard.jsx do Desktop já usa inline
  // ==========================================================

  const hoje =
    new Date();

  const hojeString =
    `${hoje.getFullYear()}-${String(
      hoje.getMonth() + 1
    ).padStart(2, "0")}-${String(
      hoje.getDate()
    ).padStart(2, "0")}`;


  const visitasHoje =
    visitas.filter(
      (visita) =>
        visita.data === hojeString
    );


  const naoComparecidos =
    visitas.filter(
      (visita) =>
        visita.comparecimento ===
          "NAO_COMPARECEU" &&
        visita.data === hojeString
    );


  const semLeadsCarregados =
    leads.length === 0;


  return (

    <div className="mobileDashboard">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <header className="mobileDashboardHeader">

        <span className="mobileDashboardHeaderTag">
          🏠 Início
        </span>

        <h1>
          Central Atitude
        </h1>

        <p>
          👋 Olá, {nomeUsuario}
        </p>

      </header>


      {semLeadsCarregados && (

        <div className="mobileDashboardVazio">
          Carregando ou nenhum lead disponível no momento.
        </div>

      )}


      {/* ====================================================
          INDICADORES
      ==================================================== */}

      <div className="mobileIndicadoresLista">

        <IndicadorCard
          icone="📅"
          rotulo="Visitas Hoje"
          numero={visitasHoje.length}
          subtitulo="Toque para ver a agenda"
          carregando={carregandoVisitas}
          onClick={() =>
            onNavegar?.("agenda")
          }
        />

        <IndicadorCard
          icone="🆕"
          rotulo="Aguardando Atendimento"
          numero={aguardando.length}
          subtitulo="Leads aguardando recepção"
          onClick={() =>
            onNavegar?.("leads")
          }
        />

        <IndicadorCard
          icone="🤝"
          rotulo="Em Atendimento"
          numero={emAtendimento.length}
          subtitulo="Leads em andamento"
          destaque
          onClick={() =>
            onNavegar?.("leads")
          }
        />

        <IndicadorCard
          icone="🎓"
          rotulo="Matrículas"
          numero={matriculas.length}
          subtitulo="Toque para ver mais"
          onClick={() =>
            onNavegar?.("matriculas")
          }
        />

        <IndicadorCard
          icone="🔴"
          rotulo="Não Comparecidos"
          numero={naoComparecidos.length}
          subtitulo="Hoje"
          carregando={carregandoVisitas}
          onClick={() =>
            onNavegar?.("agenda")
          }
        />

      </div>


      {/* ====================================================
          SEÇÃO DE ATENÇÃO
      ==================================================== */}

      {(aguardando.length > 0 ||
        naoComparecidos.length > 0) && (

        <section className="mobileSecaoAtencao">

          <h2>
            🎯 Precisa da sua atenção
          </h2>

          {aguardando.length > 0 && (

            <div className="mobileSecaoAtencaoItem">

              <span className="mobileSecaoAtencaoIcone">
                🆕
              </span>

              <div>

                <strong>
                  {aguardando.length} lead(s) aguardando atendimento
                </strong>

                <p>
                  Ainda sem nenhuma ação registrada.
                </p>

              </div>

            </div>

          )}


          {naoComparecidos.length > 0 && (

            <div
              className="mobileSecaoAtencaoItem"
              style={{ marginTop: "10px" }}
            >

              <span className="mobileSecaoAtencaoIcone">
                🔴
              </span>

              <div>

                <strong>
                  {naoComparecidos.length} não compareceu(ram) hoje
                </strong>

                <p>
                  Precisa de contato para entender o motivo.
                </p>

              </div>

            </div>

          )}

        </section>

      )}

    </div>

  );

}

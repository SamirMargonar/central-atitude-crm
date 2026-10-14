import { useState } from "react";

import { doc, getDoc } from "firebase/firestore";

import "../styles/leads.css";

import useLeads from "../../hooks/useLeads.js";

import useBuscaLeadsGlobal from "../../hooks/useBuscaLeadsGlobal.js";

import { useAuth } from "../../auth/AuthContext.jsx";

import { db } from "../../firebase/firebase.js";

import ResultadosBuscaGlobal from "../../components/ResultadosBuscaGlobal.jsx";

import {
  ETAPAS,
  JORNADA,
} from "../../core/LeadFlow.js";

import {
  filtrarLeads,
} from "../../utils/leadFilters.js";

import LeadCardMobile from "../components/LeadCardMobile.jsx";
import LeadDetailsScreen from "./LeadDetailsScreen.jsx";


// ==========================================================
// LEADS — MOBILE (FASE 3 + FASE 4)
// ==========================================================
//
// Dados: useLeads() (hook existente, não alterado) — mesma
// consulta em tempo real, já filtrada por perfil/turno.
//
// Busca: filtrarLeads() de utils/leadFilters.js (função
// existente, não alterada) — mesma busca por nome/telefone que
// o Desktop já usa em Leads.jsx. Os demais filtros dela
// (consultora/origem/objetivo/status) ficam neutros
// ("Todas"/"Todos") nesta fase — só a busca é exposta na UI.
//
// Ordenação: mesma ordem por etapa que Leads.jsx (Desktop) já
// usa, derivada de JORNADA (core/LeadFlow.js) — não é uma regra
// nova, é o mesmo critério, só recalculado aqui porque não existe
// uma função companheira exportada só para isso.
//
// Detalhes do lead: tocar num card abre LeadDetailsScreen (Fase
// 4), interno a esta tela (sem inventar uma nova aba no
// BottomNavigation) — "← Voltar" retorna à lista.
// ==========================================================

const ORDEM_ETAPAS =
  Object.fromEntries(
    JORNADA.map(
      (etapa, indice) => [
        etapa.id,
        indice,
      ]
    )
  );


export default function LeadsScreen() {

  const {
    leads,
  } = useLeads();


  const [pesquisa, setPesquisa] =
    useState("");

  const [leadAberto, setLeadAberto] =
    useState(null);

  // ==========================================================
  // BUSCA EM LEADS DE OUTRAS RECEPCIONISTAS
  //
  // Mesmo cache em memória do Desktop (uma leitura por sessão).
  // O lead de outra titular abre em "Modo consulta" (o Mobile não
  // tem ações de atendimento compartilhado — isso é do Desktop).
  // ==========================================================

  const { perfilUsuario, isRecepcionista } = useAuth();

  const buscaGlobal =
    useBuscaLeadsGlobal({
      termo: pesquisa,
      uid:
        perfilUsuario?.uid ||
        perfilUsuario?.id,
      ativo: !!isRecepcionista,
    });

  const resultadosDeOutras =
    buscaGlobal.resultados.filter(
      (resultado) =>
        !leads.some(
          (lead) =>
            lead.id === resultado.id
        )
    );

  async function abrirDeOutra(resultado) {

    try {

      const snap =
        await getDoc(
          doc(db, "leads", resultado.id)
        );

      if (snap.exists()) {
        setLeadAberto({
          id: snap.id,
          ...snap.data(),
        });
      }

    } catch (erro) {

      console.error(
        "Erro ao abrir o lead:",
        erro
      );

    }

  }


  // ==========================================================
  // ORDENA (mesmo critério de Leads.jsx: etapa, depois mais
  // recente primeiro)
  // ==========================================================

  const leadsOrdenados =
    [...leads].sort((a, b) => {

      const etapaA =
        a.etapa ??
        ETAPAS.RECEBIDO;

      const etapaB =
        b.etapa ??
        ETAPAS.RECEBIDO;

      const ordem =
        ORDEM_ETAPAS[etapaA] -
        ORDEM_ETAPAS[etapaB];

      if (ordem !== 0) {

        return ordem;

      }

      const dataA =
        a.createdAt?.seconds || 0;

      const dataB =
        b.createdAt?.seconds || 0;

      return dataB - dataA;

    });


  // ==========================================================
  // FILTRA (mesma função de busca do Desktop)
  // ==========================================================

  const leadsFiltrados =
    filtrarLeads(
      leadsOrdenados,
      {

        pesquisa,

        consultora: "Todas",

        origem: "Todas",

        objetivo: "Todos",

        status: "Todos",

      }
    );


  const semLeads =
    leads.length === 0;

  const semResultadoBusca =
    !semLeads &&
    leadsFiltrados.length === 0 &&
    resultadosDeOutras.length === 0 &&
    !buscaGlobal.carregando;


  // ==========================================================
  // DETALHES DO LEAD (FASE 4)
  // ==========================================================

  if (leadAberto) {

    return (

      <LeadDetailsScreen
        lead={leadAberto}
        onVoltar={() =>
          setLeadAberto(null)
        }
      />

    );

  }


  // ==========================================================
  // LISTA
  // ==========================================================

  return (

    <div className="mobileLeads">

      <header className="mobileLeadsHeader">

        <h1>
          Leads
        </h1>

        <p>
          {leads.length} lead(s)
        </p>

      </header>


      <div className="mobileLeadsBusca">

        <input
          type="text"
          inputMode="search"
          placeholder="🔎 Buscar por nome ou telefone..."
          value={pesquisa}
          onChange={(evento) =>
            setPesquisa(evento.target.value)
          }
        />

      </div>


      {isRecepcionista && (

        <ResultadosBuscaGlobal
          termo={pesquisa}
          resultados={resultadosDeOutras}
          carregando={buscaGlobal.carregando}
          erro={buscaGlobal.erro}
          onAbrir={abrirDeOutra}
          onAtualizar={buscaGlobal.atualizar}
        />

      )}

      {semLeads && !pesquisa.trim() && (

        <div className="mobileLeadsVazio">
          Nenhum lead disponível no momento.
        </div>

      )}


      {semResultadoBusca && (

        <div className="mobileLeadsVazio">
          Nenhum lead encontrado para "{pesquisa}".
        </div>

      )}


      {!semLeads && !semResultadoBusca && (

        <div className="mobileLeadsLista">

          {leadsFiltrados.map((lead) => (

            <LeadCardMobile
              key={lead.id}
              lead={lead}
              onClick={() =>
                setLeadAberto(lead)
              }
            />

          ))}

        </div>

      )}

    </div>

  );

}

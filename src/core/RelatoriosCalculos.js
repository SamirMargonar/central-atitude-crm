// ==========================================================
// CÁLCULOS DO MÓDULO DE RELATÓRIOS
// ==========================================================
//
// Funções puras (sem I/O). Recebem arrays de leads/visitas já
// carregados (pelas mesmas consultas já usadas em useLeads() e
// buscarVisitasPorPerfil()) e devolvem números/agrupamentos
// calculados. Nada aqui lê nem escreve no Firestore.
//
// As definições de leadsRecebidos / leadsEmAtendimento /
// matriculas / naoComparecimentos replicam EXATAMENTE a lógica
// já usada em components/Dashboard.jsx, para manter os dois
// painéis consistentes entre si.
// ==========================================================

import {
  ETAPAS,
} from "./LeadFlow";

import {
  normalizarOrigem,
  normalizarObjetivo,
} from "./RelatoriosNormalizacao";


// ==========================================================
// HELPERS
// ==========================================================

function obterEtapa(lead) {

  return Number(
    lead?.etapa ??
    ETAPAS.RECEBIDO
  );

}


// --------------------------------------------------------
// Divisão segura — denominador zero nunca produz NaN/Infinity,
// sempre "—".
// --------------------------------------------------------

export function calcularRazao(numerador, denominador) {

  if (!denominador) {
    return "—";
  }

  return numerador / denominador;

}


export function formatarPercentual(razao) {

  if (
    razao === "—" ||
    razao === null ||
    razao === undefined
  ) {
    return "—";
  }

  return `${(razao * 100).toFixed(1)}%`;

}


// --------------------------------------------------------
// Data no formato "YYYY-MM-DD", mesmo algoritmo já usado em
// NotificationCenter.jsx:obterDataHoje() — sem depender de
// timezone da biblioteca, só componentes locais do Date.
// --------------------------------------------------------

function paraDataISO(data) {

  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    )
      .padStart(2, "0");

  const dia =
    String(
      data.getDate()
    )
      .padStart(2, "0");

  return `${ano}-${mes}-${dia}`;

}


// ==========================================================
// FILTRO DE PERÍODO
// ==========================================================
//
// Leads sem createdAt NUNCA são descartados nem "chutados" para
// dentro do período — ficam separados em semData, sempre
// visíveis e contados à parte.
// ==========================================================

export function filtrarLeadsPorPeriodo(leads, dataInicioISO, dataFimISO) {

  if (
    !dataInicioISO &&
    !dataFimISO
  ) {

    return {
      dentro: leads,
      semData: [],
    };

  }


  const dentro = [];
  const semData = [];

  leads.forEach(
    (lead) => {

      const possuiData =
        lead.createdAt &&
        typeof lead.createdAt.toDate === "function";

      if (!possuiData) {
        semData.push(lead);
        return;
      }

      const dataISO =
        paraDataISO(
          lead.createdAt.toDate()
        );

      if (
        dataInicioISO &&
        dataISO < dataInicioISO
      ) {
        return;
      }

      if (
        dataFimISO &&
        dataISO > dataFimISO
      ) {
        return;
      }

      dentro.push(lead);

    }
  );

  return {
    dentro,
    semData,
  };

}


// --------------------------------------------------------
// visitas.data já é uma string "YYYY-MM-DD" — comparação
// lexicográfica direta, sem conversão de Date.
// --------------------------------------------------------

export function filtrarVisitasPorPeriodo(visitas, dataInicioISO, dataFimISO) {

  if (
    !dataInicioISO &&
    !dataFimISO
  ) {
    return visitas;
  }

  return visitas.filter(
    (visita) => {

      if (!visita.data) {
        return false;
      }

      if (
        dataInicioISO &&
        visita.data < dataInicioISO
      ) {
        return false;
      }

      if (
        dataFimISO &&
        visita.data > dataFimISO
      ) {
        return false;
      }

      return true;

    }
  );

}


// ==========================================================
// INDICADORES
// ==========================================================

export function calcularIndicadores(leads, visitas) {

  const leadsRecebidos =
    leads.filter(
      (lead) =>
        !lead.assumido &&
        obterEtapa(lead) === ETAPAS.RECEBIDO
    );

  const leadsAssumidos =
    leads.filter(
      (lead) =>
        lead.assumido === true
    );

  const leadsEmAtendimento =
    leads.filter(
      (lead) =>
        lead.assumido &&
        obterEtapa(lead) !== ETAPAS.MATRICULA
    );

  const negociacoes =
    leads.filter(
      (lead) =>
        obterEtapa(lead) === ETAPAS.NEGOCIACAO
    );

  const matriculas =
    leads.filter(
      (lead) =>
        obterEtapa(lead) === ETAPAS.MATRICULA
    );


  const visitasRealizadas =
    visitas.filter(
      (visita) =>
        visita.comparecimento === "COMPARECEU"
    );

  const naoComparecimentos =
    visitas.filter(
      (visita) =>
        visita.comparecimento === "NAO_COMPARECEU"
    );

  const pendentes =
    visitas.filter(
      (visita) =>
        !visita.comparecimento
    );


  const idsLeadsComVisita =
    new Set(
      visitas
        .map((visita) => visita.leadId)
        .filter(Boolean)
    );

  const leadsComVisita =
    leads.filter(
      (lead) =>
        idsLeadsComVisita.has(lead.id)
    );

  const leadsComVisitaEmNegociacaoOuMais =
    leadsComVisita.filter(
      (lead) =>
        obterEtapa(lead) >= ETAPAS.NEGOCIACAO
    );

  const leadsEmNegociacaoOuMais =
    leads.filter(
      (lead) =>
        obterEtapa(lead) >= ETAPAS.NEGOCIACAO
    );


  return {

    leadsRecebidos:
      leadsRecebidos.length,

    leadsAssumidos:
      leadsAssumidos.length,

    leadsEmAtendimento:
      leadsEmAtendimento.length,

    visitasAgendadas:
      visitas.length,

    visitasRealizadas:
      visitasRealizadas.length,

    naoComparecimentos:
      naoComparecimentos.length,

    pendentes:
      pendentes.length,

    negociacoes:
      negociacoes.length,

    matriculas:
      matriculas.length,

    conversaoLeadVisita:
      calcularRazao(
        leadsComVisita.length,
        leads.length
      ),

    conversaoVisitaNegociacao:
      calcularRazao(
        leadsComVisitaEmNegociacaoOuMais.length,
        leadsComVisita.length
      ),

    conversaoNegociacaoMatricula:
      calcularRazao(
        matriculas.length,
        leadsEmNegociacaoOuMais.length
      ),

    conversaoLeadMatricula:
      calcularRazao(
        matriculas.length,
        leads.length
      ),

  };

}


// ==========================================================
// FUNIL COMERCIAL
// ==========================================================
//
// Cada estágio mostra quantos leads estão ATUALMENTE naquela
// etapa (não cumulativo, não "quantos já passaram por ali" —
// isso exigiria histórico de eventos, fora do escopo desta
// versão).
// ==========================================================

const ORDEM_FUNIL = [

  ETAPAS.RECEBIDO,

  ETAPAS.CONTATO,

  ETAPAS.RESPOSTA,

  ETAPAS.VISITA,

  ETAPAS.NEGOCIACAO,

  ETAPAS.MATRICULA,

];


export function calcularFunil(leads) {

  return ORDEM_FUNIL.map(
    (etapaId) => ({

      etapa:
        etapaId,

      total:
        leads.filter(
          (lead) =>
            obterEtapa(lead) === etapaId
        ).length,

    })
  );

}


// ==========================================================
// DESEMPENHO POR GRUPO (consultora / origem / objetivo)
// ==========================================================

export function visitasDoGrupo(visitas, leadsDoGrupo) {

  const ids =
    new Set(
      leadsDoGrupo.map(
        (lead) => lead.id
      )
    );

  return visitas.filter(
    (visita) =>
      ids.has(visita.leadId)
  );

}


function agruparEDesempenho(leads, visitas, obterChave) {

  const grupos =
    new Map();

  leads.forEach(
    (lead) => {

      const chave =
        obterChave(lead);

      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }

      grupos.get(chave).push(lead);

    }
  );

  return [...grupos.entries()].map(
    ([chave, leadsDoGrupoAtual]) => ({

      categoria:
        chave,

      ...calcularIndicadores(
        leadsDoGrupoAtual,
        visitasDoGrupo(visitas, leadsDoGrupoAtual)
      ),

    })
  );

}


export function calcularDesempenhoPorOrigem(leads, visitas) {

  return agruparEDesempenho(
    leads,
    visitas,
    (lead) =>
      normalizarOrigem(lead.origem)
  );

}


export function calcularDesempenhoPorObjetivo(leads, visitas) {

  return agruparEDesempenho(
    leads,
    visitas,
    (lead) =>
      normalizarObjetivo(lead.objetivo)
  );

}


// --------------------------------------------------------
// Por consultora: agrupa por responsavelUid. `usuariosPorUid`
// é opcional — um mapa { uid: { nome, ... } } já carregado pelo
// componente (só disponível para admin/coordenador, já que
// usuarios.allow list exige isso na Rule). Sem esse mapa, o
// próprio uid é usado como rótulo.
// --------------------------------------------------------

export function calcularDesempenhoPorConsultora(leads, visitas, usuariosPorUid) {

  const grupos =
    agruparEDesempenho(
      leads,
      visitas,
      (lead) =>
        lead.responsavelUid || "(sem responsável)"
    );

  return grupos.map(
    (grupo) => ({

      ...grupo,

      nome:
        grupo.categoria === "(sem responsável)"
          ? "Sem responsável"
          : (usuariosPorUid?.[grupo.categoria]?.nome || grupo.categoria),

    })
  );

}

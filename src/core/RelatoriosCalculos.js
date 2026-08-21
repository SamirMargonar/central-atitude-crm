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

import {
  calcularDiasParaVencimento,
} from "../utils/renovacaoAlertas";


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


// ==========================================================
// V1.5 — PAINEL COMERCIAL (Dashboard)
// ==========================================================
//
// Tudo abaixo é aditivo: nenhuma função acima foi alterada, o
// módulo Relatórios continua consumindo exatamente o que já
// consumia.
// ==========================================================


// ==========================================================
// FUNIL COMERCIAL — 7 degraus, cumulativo
//
// Diferente de calcularFunil() (que conta "quantos leads estão
// ATUALMENTE em cada etapa", usado por Relatórios), este funil
// conta "quantos leads JÁ ATINGIRAM cada degrau" — cada degrau
// nunca é maior que o anterior. "Compareceu" não é uma etapa do
// lead: cruza com a coleção de visitas e conta LEADS ÚNICOS
// (não visitas), restritos ao conjunto de leads recebido.
// ==========================================================

const ORDEM_FUNIL_COMERCIAL = [

  { chave: "recebidos", label: "Recebidos" },

  { chave: "atendimento", label: "Atendimento" },

  { chave: "contato", label: "Contato" },

  { chave: "visita", label: "Visita" },

  { chave: "compareceu", label: "Compareceu" },

  { chave: "negociacao", label: "Negociação" },

  { chave: "matricula", label: "Matrícula" },

];

export function calcularFunilComercial(leads, visitas) {

  const recebidos =
    leads.length;

  const atendimento =
    leads.filter(
      (lead) => lead.assumido === true
    ).length;

  const contato =
    leads.filter(
      (lead) => obterEtapa(lead) >= ETAPAS.CONTATO
    ).length;

  const visita =
    leads.filter(
      (lead) => obterEtapa(lead) >= ETAPAS.VISITA
    ).length;

  const idsLeadsNoEscopo =
    new Set(
      leads.map((lead) => lead.id)
    );

  const idsCompareceram =
    new Set(
      visitas
        .filter(
          (visita) => visita.comparecimento === "COMPARECEU"
        )
        .map((visita) => visita.leadId)
        .filter(
          (leadId) => leadId && idsLeadsNoEscopo.has(leadId)
        )
    );

  const compareceu =
    idsCompareceram.size;

  const negociacao =
    leads.filter(
      (lead) => obterEtapa(lead) >= ETAPAS.NEGOCIACAO
    ).length;

  const matricula =
    leads.filter(
      (lead) => obterEtapa(lead) === ETAPAS.MATRICULA
    ).length;

  const totais = {
    recebidos,
    atendimento,
    contato,
    visita,
    compareceu,
    negociacao,
    matricula,
  };

  return ORDEM_FUNIL_COMERCIAL.map(
    (degrau) => ({

      chave: degrau.chave,

      label: degrau.label,

      total: totais[degrau.chave],

    })
  );

}


// ==========================================================
// NEGOCIAÇÕES PARADAS
//
// etapa === NEGOCIACAO e lead.atualizadoEm (Timestamp real do
// Firestore, gravado por atualizarLead() em toda escrita) tem
// diasLimite dias ou mais. Sem Timestamp confiável, o lead NÃO
// entra — conservador, nunca assume "parada" sem conseguir medir.
// ==========================================================

export function filtrarNegociacoesParadas(leads, hoje = new Date(), diasLimite = 3) {

  return leads.filter(
    (lead) => {

      if (
        obterEtapa(lead) !== ETAPAS.NEGOCIACAO
      ) {

        return false;

      }

      const atualizadoEm =
        lead.atualizadoEm;

      if (
        !atualizadoEm ||
        typeof atualizadoEm.toDate !== "function"
      ) {

        return false;

      }

      const diferencaMs =
        hoje.getTime() -
        atualizadoEm.toDate().getTime();

      const diferencaDias =
        diferencaMs / (1000 * 60 * 60 * 24);

      return diferencaDias >= diasLimite;

    }
  );

}


// ==========================================================
// PRESETS DE PERÍODO — Hoje / 7 dias / 30 dias / Personalizado
//
// Alimenta filtrarLeadsPorPeriodo/filtrarVisitasPorPeriodo já
// existentes — nenhuma lógica de filtro nova, só o cálculo do
// intervalo. "Personalizado" (ou qualquer preset desconhecido)
// devolve datas vazias — o controle fica manual, via os campos
// de data já existentes.
// ==========================================================

export function calcularIntervaloPeriodo(preset, hoje = new Date()) {

  const hojeISO =
    paraDataISO(hoje);

  if (preset === "HOJE") {

    return {
      dataInicio: hojeISO,
      dataFim: hojeISO,
    };

  }

  if (preset === "7_DIAS") {

    const inicio =
      new Date(hoje);

    inicio.setDate(
      inicio.getDate() - 6
    );

    return {
      dataInicio: paraDataISO(inicio),
      dataFim: hojeISO,
    };

  }

  if (preset === "30_DIAS") {

    const inicio =
      new Date(hoje);

    inicio.setDate(
      inicio.getDate() - 29
    );

    return {
      dataInicio: paraDataISO(inicio),
      dataFim: hojeISO,
    };

  }

  return {
    dataInicio: "",
    dataFim: "",
  };

}


// ==========================================================
// RENOVAÇÕES PRÓXIMAS
//
// Janela de 60 dias (alinhada ao primeiro marco de alerta da
// V1.3), reaproveitando calcularDiasParaVencimento — nenhuma
// lógica nova de alerta/persistência, só uma lista para exibição.
// ==========================================================

export function filtrarRenovacoesProximas(leads, diasLimite = 60, hoje = new Date()) {

  return leads.filter(
    (lead) => {

      if (
        lead?.matricula?.confirmada !== true
      ) {

        return false;

      }

      const dias =
        calcularDiasParaVencimento(
          lead.matricula.dataVencimento,
          hoje
        );

      if (
        dias === null ||
        dias < 0
      ) {

        return false;

      }

      return dias <= diasLimite;

    }
  );

}


// ==========================================================
// "PRECISA DA SUA ATENÇÃO" — filtros de apoio
// ==========================================================

export function filtrarLeadsSemAtendimento(leads) {

  return leads.filter(
    (lead) =>
      !lead.assumido &&
      obterEtapa(lead) === ETAPAS.RECEBIDO
  );

}

export function filtrarLeadsSemResposta(leads) {

  return leads.filter(
    (lead) => lead.semResposta === true
  );

}

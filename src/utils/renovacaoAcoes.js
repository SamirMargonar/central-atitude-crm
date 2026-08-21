// ==========================================================
// PROCESSO DE RENOVAÇÃO — funções puras
//
// Regra crítica aprovada: registrar uma recusa (não renovação)
// NUNCA altera matricula.status — só adiciona
// motivoNaoRenovacao/naoRenovadoEm/naoRenovadoPor/
// naoRenovadoPorNome, preservando todo o resto do objeto
// (inclusive o status atual, seja qual for).
// ==========================================================


// ==========================================================
// VENCIMENTO DA RENOVAÇÃO
//
// Mesma lógica de MatriculaAction.jsx (não alterado, não
// importado — duplicado aqui, mesmo padrão já usado no
// projeto para pequenas funções de data/formatação).
// ==========================================================

export function calcularVencimentoRenovacao(
  dataInicio,
  plano
) {

  if (!dataInicio) {
    return "";
  }

  const inicio =
    new Date(`${dataInicio}T12:00:00`);

  if (
    Number.isNaN(inicio.getTime())
  ) {

    return "";

  }

  const vencimento =
    new Date(inicio);

  if (plano === "MENSAL") {

    vencimento.setMonth(
      vencimento.getMonth() + 1
    );

  }

  if (plano === "TRIMESTRAL") {

    vencimento.setMonth(
      vencimento.getMonth() + 3
    );

  }

  if (plano === "SEMESTRAL") {

    vencimento.setMonth(
      vencimento.getMonth() + 6
    );

  }

  if (plano === "ANUAL") {

    vencimento.setFullYear(
      vencimento.getFullYear() + 1
    );

  }

  const ano =
    vencimento.getFullYear();

  const mes =
    String(
      vencimento.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      vencimento.getDate()
    ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;

}


// ==========================================================
// NOVA MATRÍCULA APÓS RENOVAÇÃO
//
// Preserva tudo o que já existia (confirmada, consultor,
// data/hora da confirmação original, observacao, status) e
// só troca plano/dataInicio/dataVencimento.
// ==========================================================

export function construirMatriculaRenovada(
  matriculaAtual,
  { plano, dataInicio, dataVencimento }
) {

  return {

    ...matriculaAtual,

    plano,

    dataInicio,

    dataVencimento,

  };

}


// ==========================================================
// NOVA MATRÍCULA APÓS RECUSA (NÃO RENOVAÇÃO)
//
// NUNCA toca em matricula.status — apenas acrescenta os
// campos de recusa, preservando todo o restante do objeto.
// ==========================================================

export function construirMatriculaComRecusa(
  matriculaAtual,
  { motivo, uid, nome, agora }
) {

  return {

    ...matriculaAtual,

    motivoNaoRenovacao: motivo,

    naoRenovadoEm: agora,

    naoRenovadoPor: uid,

    naoRenovadoPorNome: nome,

  };

}


// ==========================================================
// NOME DO PLANO (mesma tabela já usada em Renovacoes.jsx)
// ==========================================================

const NOMES_PLANO = {

  MENSAL: "Plano Mensal",

  TRIMESTRAL: "Plano Trimestral",

  SEMESTRAL: "Plano Semestral",

  ANUAL: "Plano Anual",

};

function nomePlano(plano) {

  return (
    NOMES_PLANO[plano] ||
    plano ||
    "Plano não informado"
  );

}


// ==========================================================
// FORMATA DATA ISO (aaaa-mm-dd -> dd/mm/aaaa)
// ==========================================================

function formatarData(data) {

  if (!data) {
    return "não informada";
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
// MENSAGEM PADRÃO DE CONTATO DE RENOVAÇÃO
// ==========================================================

export function construirMensagemContato(
  cliente
) {

  const nome =
    cliente?.nome || "";

  const plano =
    nomePlano(
      cliente?.matricula?.plano
    );

  const vencimento =
    formatarData(
      cliente?.matricula?.dataVencimento
    );

  return `Olá ${nome}! 😊 Seu ${plano} vence em ${vencimento}. Vamos conversar sobre a renovação?`;

}


// ==========================================================
// LINK DO WHATSAPP (mesmo padrão de PrimeiroContatoAction.jsx)
// ==========================================================

export function construirLinkWhatsApp(
  telefone,
  mensagem
) {

  const numero =
    String(telefone || "").replace(
      /\D/g,
      ""
    );

  return `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;

}

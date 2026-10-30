// ==========================================================
// PROCESSO DE RENOVAÇÃO — funções puras
//
// Regra crítica aprovada: registrar uma recusa (não renovação)
// NUNCA altera matricula.status — só adiciona
// motivoNaoRenovacao/naoRenovadoEm/naoRenovadoPor/
// naoRenovadoPorNome, preservando todo o resto do objeto
// (inclusive o status atual, seja qual for).
// ==========================================================


import {
  MESES_POR_CODIGO_LEGADO,
  aplicarSnapshotNaMatricula,
  calcularVencimentoPorMeses,
  duracaoEmMeses,
  nomeDaMatricula,
} from "./planos.js";


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

  // `plano` pode ser o CÓDIGO legado (string: MENSAL, TRIMESTRAL,
  // SEMESTRAL, ANUAL — comportamento de sempre) ou o objeto do plano
  // escolhido no catálogo (usa a duração em meses dele).
  const meses =
    typeof plano === "string"
      ? MESES_POR_CODIGO_LEGADO[plano] ?? null
      : duracaoEmMeses(plano);

  return calcularVencimentoPorMeses(
    dataInicio,
    meses
  );

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
  { plano, dataInicio, dataVencimento, snapshot = null }
) {

  // Com `snapshot` (plano do catálogo): a renovação é um NOVO contrato,
  // então os campos de instantâneo do plano anterior são substituídos
  // pelos do plano escolhido (sem misturar valor de um com nome de
  // outro). Sem `snapshot`: comportamento legado (só o código).
  const base =
    snapshot
      ? aplicarSnapshotNaMatricula(
          matriculaAtual,
          snapshot
        )
      : { ...matriculaAtual, plano };

  return {
    ...base,
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
// NOME DO PLANO — do instantâneo da matrícula (ou códigos legados)
// ==========================================================

function nomePlano(matricula) {
  return nomeDaMatricula(matricula);
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
      cliente?.matricula
    );

  const vencimento =
    formatarData(
      cliente?.matricula?.dataVencimento
    );

  return `Olá ${nome}! 😊 Seu ${plano} vence em ${vencimento}. Vamos conversar sobre a renovação?`;

}


// ==========================================================
// LINK DO WHATSAPP
//
// Implementação única agora em src/utils/whatsapp.js —
// reexportada aqui para que nada que já importa
// construirLinkWhatsApp deste arquivo (ex.: RenovacaoAcoes.jsx)
// precise mudar.
// ==========================================================

export {
  construirLinkWhatsApp,
} from "./whatsapp.js";

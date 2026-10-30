// ==========================================================
// WHATSAPP — função utilitária única
//
// Antes desta extração, a mesma lógica existia duplicada em
// PrimeiroContatoAction.jsx (inline) e em
// src/utils/renovacaoAcoes.js (exportada). Esta é agora a
// única implementação — renovacaoAcoes.js reexporta esta
// função, então nenhum ponto de chamada existente precisou
// mudar.
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


// ==========================================================
// NÚMERO PARA ABRIR CONVERSA NO WHATSAPP (wa.me)
//
// Normaliza o telefone cadastrado no lead para o formato
// internacional brasileiro (55 + DDD + número) SEM ADIVINHAR nada:
// quando o número não tem DDD identificável (ou é ambíguo), devolve
// ok:false com uma orientação — o botão fica indisponível em vez de
// direcionar a conversa para outra pessoa.
//
//  - com máscara, espaços, hífens (inclusive hífen/espaço especiais)
//    e "+": só os dígitos importam;
//  - 11 dígitos (DDD + 9 + 8 dígitos) e 10 dígitos (DDD + 8) com DDD
//    válido: aceitos, recebem o 55;
//  - já com DDI (55 + 10/11 dígitos): mantido, sem duplicar o 55;
//  - zero de tronco antes do DDD (041...): removido;
//  - 8/9 dígitos (sem DDD), DDD inexistente, número que começa com
//    "55" mas é ambíguo (DDI sem DDD x DDD 55) e formatos estranhos:
//    indisponível.
// ==========================================================

const DDDS_VALIDOS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export const ORIENTACAO_TELEFONE_SEM_DDD =
  "Telefone sem DDD: corrija o telefone no cadastro do lead (com DDD) para habilitar o WhatsApp.";

export const ORIENTACAO_TELEFONE_INVALIDO =
  "Telefone em formato não reconhecido: corrija o telefone no cadastro do lead para habilitar o WhatsApp.";

// Versões curtas para a tela (o texto completo vai no tooltip).
export const ORIENTACAO_CURTA = {
  sem_ddd: "Sem DDD: corrija o telefone no cadastro.",
  invalido: "Formato inválido: corrija o telefone no cadastro.",
  ambiguo: "Começa com 55: confirme DDD/DDI no cadastro.",
};

export const ORIENTACAO_TELEFONE_AMBIGUO =
  "Telefone começa com 55 e não dá para saber se é o código do país ou o DDD: confirme e corrija o telefone no cadastro do lead.";

function dddEnumeroValidos(digitos) {
  // digitos = DDD + número local (10 ou 11 dígitos)
  if (!DDDS_VALIDOS.has(digitos.slice(0, 2))) {
    return false;
  }
  if (digitos.length === 11) {
    return digitos[2] === "9";
  }
  return digitos.length === 10 && /[2-9]/.test(digitos[2]);
}

export function normalizarTelefoneWhatsApp(telefone) {
  let digitos = String(telefone ?? "").replace(/\D/g, "");

  if (!digitos) {
    return { ok: false, motivo: "vazio", mensagem: "" };
  }

  // prefixo de ligação internacional (00) e zero de tronco antes do DDD
  digitos = digitos.replace(/^00/, "");
  if (digitos.startsWith("0") && [11, 12].includes(digitos.length)) {
    digitos = digitos.slice(1);
  }

  // já com DDI 55 + DDD + número (12 ou 13 dígitos)
  if (digitos.startsWith("55") && [12, 13].includes(digitos.length)) {
    const resto = digitos.slice(2);
    if (dddEnumeroValidos(resto)) {
      return { ok: true, numero: `55${resto}`, url: `https://wa.me/55${resto}` };
    }
    return { ok: false, motivo: "invalido", mensagem: ORIENTACAO_TELEFONE_INVALIDO, mensagemCurta: ORIENTACAO_CURTA.invalido };
  }

  // 10/11 dígitos que começam com 55: DDI sem DDD ou DDD 55? ambíguo.
  if (digitos.startsWith("55") && [10, 11].includes(digitos.length)) {
    return { ok: false, motivo: "ambiguo", mensagem: ORIENTACAO_TELEFONE_AMBIGUO, mensagemCurta: ORIENTACAO_CURTA.ambiguo };
  }

  // sem DDD (só o número local)
  if (digitos.length === 8 || digitos.length === 9) {
    return { ok: false, motivo: "sem_ddd", mensagem: ORIENTACAO_TELEFONE_SEM_DDD, mensagemCurta: ORIENTACAO_CURTA.sem_ddd };
  }

  if ([10, 11].includes(digitos.length) && dddEnumeroValidos(digitos)) {
    return { ok: true, numero: `55${digitos}`, url: `https://wa.me/55${digitos}` };
  }

  return { ok: false, motivo: "invalido", mensagem: ORIENTACAO_TELEFONE_INVALIDO, mensagemCurta: ORIENTACAO_CURTA.invalido };
}

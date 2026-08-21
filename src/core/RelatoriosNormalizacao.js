// ==========================================================
// NORMALIZAÇÃO DE ORIGEM E OBJETIVO — SOMENTE PARA RELATÓRIOS
// ==========================================================
//
// Funções puras (sem I/O, sem leitura/escrita no Firestore).
// Servem apenas para agrupar, nos relatórios, os valores
// históricos sujos de leads.origem / leads.objetivo em
// categorias canônicas. O dado original no Firestore nunca é
// alterado — a normalização acontece só no momento de exibir
// os relatórios.
//
// Qualquer valor que não seja reconhecido com segurança cai em
// "Outros" — nunca é descartado, nunca lança erro.
// ==========================================================


// ==========================================================
// ORIGEM
// ==========================================================

export const CATEGORIAS_ORIGEM = [

  "Site",

  "Instagram",

  "WhatsApp",

  "Indicação",

  "Espontânea",

  "Google",

  "Facebook",

  "Outros",

];


// --------------------------------------------------------
// Chave = valor bruto normalizado (trim + minúsculo).
// "Dinossauro" / "dino" / "dinosauro" e "Passou em Frente"
// NÃO aparecem aqui de propósito — caem no fallback "Outros",
// por não serem categorias oficiais reconhecíveis com segurança.
// --------------------------------------------------------

const MAPA_ORIGEM = {

  "site": "Site",

  "instagram": "Instagram",
  "insta": "Instagram",
  "instagra": "Instagram",

  "whatsapp": "WhatsApp",
  "wpp": "WhatsApp",

  "indicação": "Indicação",
  "indicacao": "Indicação",

  "espontânea": "Espontânea",
  "espontanea": "Espontânea",

  "google": "Google",

  "facebook": "Facebook",

};


export function normalizarOrigem(valorBruto) {

  const chave =
    String(valorBruto || "")
      .trim()
      .toLowerCase();

  if (!chave) {
    return "Outros";
  }

  return (
    MAPA_ORIGEM[chave] ||
    "Outros"
  );

}


// ==========================================================
// OBJETIVO
// ==========================================================
//
// Só as 4 categorias oficiais do dropdown atual (LeadModal.jsx)
// são reconhecidas. Tudo o que não for exatamente uma delas
// (incluindo variações de capitalização) cai em "Outros" — não
// tentamos adivinhar se "Ganho" significa "Viva Movimento" ou
// qualquer outra categoria, por não ser uma correspondência
// segura.
// ==========================================================

export const CATEGORIAS_OBJETIVO = [

  "Viva Forma",

  "Viva Leve",

  "Viva Saúde",

  "Viva Movimento",

  "Outros",

];


const MAPA_OBJETIVO = {

  "viva forma": "Viva Forma",

  "viva leve": "Viva Leve",

  "viva saúde": "Viva Saúde",
  "viva saude": "Viva Saúde",

  "viva movimento": "Viva Movimento",

};


export function normalizarObjetivo(valorBruto) {

  const chave =
    String(valorBruto || "")
      .trim()
      .toLowerCase();

  if (!chave) {
    return "Outros";
  }

  return (
    MAPA_OBJETIVO[chave] ||
    "Outros"
  );

}

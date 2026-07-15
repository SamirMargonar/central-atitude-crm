// ===============================
// ETAPAS DA JORNADA DO CLIENTE
// ===============================

export const ETAPAS = {

  RECEBIDO: 0,

  CONTATO: 1,

  VISITA: 2,

  NEGOCIACAO: 3,

  MATRICULA: 4,

};

// Ordem das etapas

export const JORNADA = [

  {
    id: ETAPAS.RECEBIDO,
    nome: "Recebido",
  },

  {
    id: ETAPAS.CONTATO,
    nome: "Contato",
  },

  {
    id: ETAPAS.VISITA,
    nome: "Visita",
  },

  {
    id: ETAPAS.NEGOCIACAO,
    nome: "Negociação",
  },

  {
    id: ETAPAS.MATRICULA,
    nome: "Matrícula",
  },

];

// Retorna a próxima etapa

export function proximaEtapa(etapaAtual) {

  if (etapaAtual >= JORNADA.length - 1) {

    return etapaAtual;

  }

  return etapaAtual + 1;

}

// Nome da etapa

export function nomeDaEtapa(etapa) {

  const encontrada = JORNADA.find(

    (item) => item.id === etapa

  );

  return encontrada?.nome || "Recebido";

}
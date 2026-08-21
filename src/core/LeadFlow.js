// ===============================
// ETAPAS DA JORNADA DO CLIENTE
// ===============================

export const ETAPAS = {

  RECEBIDO: 0,

  CONTATO: 1,

  RESPOSTA: 2,

  VISITA: 3,

  NEGOCIACAO: 4,

  MATRICULA: 5,

};


// ===============================
// ORDEM DA JORNADA
// ===============================

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

    id: ETAPAS.RESPOSTA,

    nome: "Resposta",

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


// ===============================
// PRÓXIMA ETAPA
// ===============================

export function proximaEtapa(
  etapaAtual
) {

  if (
    etapaAtual >=
    JORNADA.length - 1
  ) {

    return etapaAtual;

  }


  return etapaAtual + 1;

}


// ===============================
// NOME DA ETAPA
// ===============================

export function nomeDaEtapa(
  etapa
) {

  const encontrada =
    JORNADA.find(

      (item) =>
        item.id === etapa

    );


  return (
    encontrada?.nome ||
    "Recebido"
  );

}
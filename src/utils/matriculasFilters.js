// ==========================================================
// MATRÍCULAS — funções puras do relatório
//
// Critério de matriculado: lead.matricula?.confirmada === true
// (mesmo critério já usado em Renovacoes.jsx, mais preciso que
// etapa === ETAPAS.MATRICULA porque garante que o objeto
// matricula existe antes de ler seus campos).
// ==========================================================

export function filtrarMatriculados(
  leads
) {

  return leads.filter(
    (lead) =>
      lead?.matricula?.confirmada ===
      true
  );

}


// ==========================================================
// TITULARIDADE x AUTORIA DA MATRÍCULA
//
// REGRA DE NEGÓCIO (definitiva): a matrícula conta para a
// consultora TITULAR do lead (quem é a responsável pelo lead),
// mesmo que outra recepcionista tenha realizado o atendimento e o
// fechamento. A AUTORIA do fechamento é outra informação: fica em
// matricula.registradoPorUid / registradoPorNome e no evento
// MATRICULA do histórico.
//
// Matrículas antigas não têm registradoPor*: o `consultor` delas
// era o nome de quem confirmou, que na prática era a titular.
// ==========================================================

export function consultoraTitularDaMatricula(
  lead
) {

  return (
    lead?.responsavel ||
    lead?.consultora ||
    lead?.matricula?.consultor ||
    ""
  );

}


// Nome de quem realizou o fechamento QUANDO for outra pessoa que
// não a titular; vazio quando foi a própria titular (ou quando a
// matrícula é antiga e não registra a autoria).
export function fechamentoPorOutraPessoa(
  lead
) {

  const matricula =
    lead?.matricula || {};

  const autorNome =
    matricula.registradoPorNome || "";

  if (!autorNome) {
    return "";
  }

  if (
    matricula.registradoPorUid &&
    lead?.responsavelUid
  ) {

    return matricula.registradoPorUid !== lead.responsavelUid
      ? autorNome
      : "";

  }

  const normalizar = (texto) =>
    String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  return normalizar(autorNome) !==
    normalizar(consultoraTitularDaMatricula(lead))
    ? autorNome
    : "";

}


// ==========================================================
// FORMATA DATA ISO (aaaa-mm-dd) PARA dd/mm/aaaa
//
// Usada para matricula.dataInicio e matricula.dataVencimento.
// matricula.data já vem pronta em dd/mm/aaaa (toLocaleDateString
// pt-BR) e não deve passar por esta função.
// ==========================================================

export function formatarDataMatricula(
  data
) {

  if (!data) {
    return "--/--/----";
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
// NOME DO PLANO
// ==========================================================

const NOMES_PLANO = {

  MENSAL:
    "Plano Mensal",

  TRIMESTRAL:
    "Plano Trimestral",

  SEMESTRAL:
    "Plano Semestral",

  ANUAL:
    "Plano Anual",

};

export function nomePlanoMatricula(
  plano
) {

  return (
    NOMES_PLANO[plano] ||
    plano ||
    "Plano não informado"
  );

}


// ==========================================================
// FILTRO DO RELATÓRIO (busca por nome + plano + consultor)
// ==========================================================

export function filtrarRelatorioMatriculas(
  matriculados,
  filtros
) {

  const busca =
    (filtros?.busca || "")
      .toLowerCase()
      .trim();

  const plano =
    filtros?.plano || "Todos";

  const consultor =
    filtros?.consultor || "Todos";

  return matriculados.filter(
    (lead) => {

      if (
        busca &&
        !String(lead.nome || "")
          .toLowerCase()
          .includes(busca)
      ) {

        return false;

      }

      if (
        plano !== "Todos" &&
        lead.matricula?.plano !== plano
      ) {

        return false;

      }

      if (
        consultor !== "Todos" &&
        consultoraTitularDaMatricula(lead) !== consultor
      ) {

        return false;

      }

      return true;

    }

  );

}

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
        lead.matricula?.consultor !== consultor
      ) {

        return false;

      }

      return true;

    }

  );

}

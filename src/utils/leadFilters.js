export function filtrarLeads(leads, filtros) {

  return leads.filter((lead) => {

    // PESQUISA

    if (
      filtros.pesquisa &&
      !lead.nome
        ?.toLowerCase()
        .includes(filtros.pesquisa.toLowerCase())
    ) {
      return false;
    }

    // CONSULTORA

    if (
      filtros.consultora !== "Todas" &&
      lead.consultora !== filtros.consultora
    ) {
      return false;
    }

    // ORIGEM

    if (
      filtros.origem !== "Todas" &&
      lead.origem !== filtros.origem
    ) {
      return false;
    }

    // OBJETIVO

    if (
      filtros.objetivo !== "Todos" &&
      lead.objetivo !== filtros.objetivo
    ) {
      return false;
    }

    // STATUS

    if (
      filtros.status !== "Todos" &&
      lead.status !== filtros.status
    ) {
      return false;
    }

    return true;

  });

}
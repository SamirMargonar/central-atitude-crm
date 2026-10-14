import {
  ETAPAS,
  nomeDaEtapa,
} from "../core/LeadFlow";

import {
  leadCombinaComBusca,
} from "./buscaLeads";


export function filtrarLeads(
  leads,
  filtros
) {

  return leads.filter((lead) => {

    // ==========================================
    // PESQUISA
    // Nome ou telefone
    // ==========================================

    if (filtros.pesquisa) {

      // Mesmo critério da busca global (sem acento/caixa, partes
      // do nome, telefone com ou sem máscara).
      if (
        !leadCombinaComBusca(
          lead,
          filtros.pesquisa
        )
      ) {

        return false;

      }

    }


    // ==========================================
    // CONSULTORA
    // ==========================================

    if (
      filtros.consultora !== "Todas" &&
      lead.consultora !== filtros.consultora
    ) {

      return false;

    }


    // ==========================================
    // ORIGEM
    // ==========================================

    if (
      filtros.origem !== "Todas" &&
      lead.origem !== filtros.origem
    ) {

      return false;

    }


    // ==========================================
    // OBJETIVO
    // ==========================================

    if (
      filtros.objetivo !== "Todos" &&
      lead.objetivo !== filtros.objetivo
    ) {

      return false;

    }


    // ==========================================
    // STATUS / ETAPA
    // ==========================================

    if (
      filtros.status !== "Todos"
    ) {

      const etapaAtual =
        Number(
          lead.etapa ??
          ETAPAS.RECEBIDO
        );


      const statusAtual =
        nomeDaEtapa(etapaAtual);


      if (
        statusAtual !==
        filtros.status
      ) {

        return false;

      }

    }


    // ==========================================
    // MÊS
    // ==========================================

    if (
      filtros.mes &&
      filtros.mes !== "Todos"
    ) {

      const createdAt =
        lead.createdAt;


      // Se ainda não recebeu
      // o timestamp do Firebase
      if (!createdAt) {

        return false;

      }


      let dataCriacao;


      // Firebase Timestamp
      if (
        createdAt.seconds
      ) {

        dataCriacao =
          new Date(
            createdAt.seconds * 1000
          );

      }

      // Caso seja Date
      else if (
        createdAt instanceof Date
      ) {

        dataCriacao =
          createdAt;

      }

      else {

        return false;

      }


      const ano =
        dataCriacao.getFullYear();


      const mes =
        String(
          dataCriacao.getMonth() + 1
        ).padStart(2, "0");


      const mesLead =
        `${ano}-${mes}`;


      if (
        mesLead !== filtros.mes
      ) {

        return false;

      }

    }


    return true;

  });

}
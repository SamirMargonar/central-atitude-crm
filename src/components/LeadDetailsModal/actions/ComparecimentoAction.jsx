import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  ETAPAS,
  proximaEtapa,
  nomeDaEtapa,
} from "../../../core/LeadFlow";

export default function ComparecimentoAction({
  lead,
  setLead,
}) {

  async function registrarComparecimento() {

    try {

      const novaEtapa =
        proximaEtapa(ETAPAS.VISITA);

      const ultimoAtendimento =
        new Date().toLocaleString("pt-BR");


      // ==========================================
      // 1. ATUALIZA O LEAD
      // ==========================================

      await atualizarLead(
        lead.id,
        {
          etapa: novaEtapa,
          ultimoAtendimento,
        }
      );


      // ==========================================
      // 2. ATUALIZA NA TELA
      // ==========================================

      if (setLead) {

        setLead({
          ...lead,
          etapa: novaEtapa,
          ultimoAtendimento,
        });

      }


      // ==========================================
      // 3. REGISTRA COMPARECIMENTO
      // ==========================================

      await registrarEvento({

        leadId: lead.id,

        tipo: "VISITA",

        usuario: "Samir",

        descricao:
          "Cliente compareceu à visita.",

      });


      // ==========================================
      // 4. REGISTRA AVANÇO DA JORNADA
      // ==========================================

      await registrarEvento({

        leadId: lead.id,

        tipo: "JORNADA",

        usuario: "Samir",

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(novaEtapa)}"`,

        dados: {

          etapaAnterior:
            ETAPAS.VISITA,

          novaEtapa,

        },

      });


    } catch (erro) {

      console.error(
        "Erro ao registrar comparecimento:",
        erro
      );

      alert(
        "Não foi possível registrar o comparecimento."
      );

    }

  }


  return (

    <button
      className="btnAcaoPrincipal"
      onClick={registrarComparecimento}
    >
      🏋 Registrar Comparecimento
    </button>

  );

}
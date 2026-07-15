import { atualizarLead, registrarEvento } from "../../core/EventEngine";
import {
  ETAPAS,
  proximaEtapa,
  nomeDaEtapa,
} from "../../core/LeadFlow";

import "./LeadDetailsModal.css";

export default function LeadActions({ lead }) {

  const etapaAtual = lead?.etapa ?? ETAPAS.RECEBIDO;

  const usuario = {
    nome: "Samir",
    perfil: "Administrador",
  };

  async function avancarEtapa() {

    if (etapaAtual >= ETAPAS.MATRICULA) return;

    const novaEtapa = proximaEtapa(etapaAtual);

    await atualizarLead(lead.id, {
      etapa: novaEtapa,
      ultimoAtendimento: new Date().toLocaleString("pt-BR"),
    });

    await registrarEvento({
      leadId: lead.id,
      tipo: "JORNADA",
      usuario: usuario.nome,
      descricao: `Lead avançou para "${nomeDaEtapa(novaEtapa)}"`,
    });

  }

  function textoBotao() {

    switch (etapaAtual) {

      case ETAPAS.RECEBIDO:
        return "📞 Registrar Primeiro Contato";

      case ETAPAS.CONTATO:
        return "📅 Agendar Visita";

      case ETAPAS.VISITA:
        return "🏋 Registrar Comparecimento";

      case ETAPAS.NEGOCIACAO:
        return "💳 Confirmar Matrícula";

      default:
        return "✅ Jornada Finalizada";

    }

  }

  return (

    <section className="leadActions">

      <button
        className="btnAcaoPrincipal"
        onClick={avancarEtapa}
        disabled={etapaAtual >= ETAPAS.MATRICULA}
      >

        {textoBotao()}

      </button>

    </section>

  );

}
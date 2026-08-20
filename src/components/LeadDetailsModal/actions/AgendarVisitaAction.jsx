import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  ETAPAS,
  proximaEtapa,
  nomeDaEtapa,
} from "../../../core/LeadFlow";

import { criarVisita } from "../../../Agenda/VisitaEngine";

export default function AgendarVisitaAction({
  lead,
  setLead,
}) {

  const [aberto, setAberto] =
    useState(false);

  const [data, setData] =
    useState("");

  const [hora, setHora] =
    useState("");

  const [observacao, setObservacao] =
    useState("");


  // ============================================================
  // RESPONSÁVEL DO LEAD
  //
  // O responsável comercial é sempre o responsável ATUAL do Lead
  // (leads/{leadId}.responsavelUid). O usuário não escolhe outro
  // consultor aqui — o agendamento não transfere o Lead.
  // ============================================================

  const nomeResponsavel =
    lead?.responsavel ||
    lead?.consultora ||
    "";


  async function agendar() {

    if (!data || !hora) {

      alert(
        "Selecione a data e o horário."
      );

      return;

    }


    if (!nomeResponsavel) {

      alert(
        "Este Lead ainda não possui um responsável definido. Assuma o Lead antes de agendar uma visita."
      );

      return;

    }


    try {

      const novaEtapa =
        proximaEtapa(
          ETAPAS.CONTATO
        );


      const ultimoAtendimento =
        new Date().toLocaleString(
          "pt-BR"
        );


      // ==========================================
      // 1. CRIA A VISITA
      // ==========================================

      const visitaSalva =
        await criarVisita({

          leadId: lead.id,

          leadNome:
            lead.nome || "",

          data,

          hora,

          consultora:
            nomeResponsavel,

          observacao,

        });


      // ==========================================
      // 2. GUARDA O ID DA VISITA
      // ==========================================

      const visita = {

        id: visitaSalva.id,

        data,

        hora,

        consultor:
          nomeResponsavel,

        observacao,

      };


      // ==========================================
      // 3. ATUALIZA O LEAD
      // ==========================================

      await atualizarLead(
        lead.id,
        {

          etapa: novaEtapa,

          ultimoAtendimento,

          visita,

        }
      );


      // ==========================================
      // 4. ATUALIZA NA TELA
      // ==========================================

      if (setLead) {

        setLead({

          ...lead,

          etapa: novaEtapa,

          ultimoAtendimento,

          visita,

        });

      }


      // ==========================================
      // 5. REGISTRA EVENTO
      // ==========================================

      await registrarEvento({

        leadId: lead.id,

        tipo: "VISITA",

        usuario: nomeResponsavel,

        descricao:
          "Visita agendada.",

        dados: visita,

      });


      // ==========================================
      // 6. REGISTRA AVANÇO
      // ==========================================

      await registrarEvento({

        leadId: lead.id,

        tipo: "JORNADA",

        usuario: nomeResponsavel,

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(novaEtapa)}"`,

        dados: {

          etapaAnterior:
            ETAPAS.CONTATO,

          novaEtapa,

        },

      });


      // ==========================================
      // 7. LIMPA
      // ==========================================

      setData("");

      setHora("");

      setObservacao("");

      setAberto(false);


      alert(
        "Visita agendada com sucesso!"
      );


    } catch (erro) {

      console.error(
        "Erro ao agendar visita:",
        erro
      );

      alert(
        "Não foi possível agendar a visita. Verifique o console."
      );

    }

  }


  return (

    <>

      <button
        className="btnAcaoPrincipal"
        onClick={() =>
          setAberto(true)
        }
      >
        📅 Agendar Visita
      </button>


      <LeadActionModal
        aberto={aberto}
        titulo="Agendar Visita"
      >

        <label>
          📅 Data da visita
        </label>

        <input
          type="date"
          value={data}
          onChange={(e) =>
            setData(e.target.value)
          }
        />


        <label>
          🕒 Horário
        </label>

        <input
          type="time"
          value={hora}
          onChange={(e) =>
            setHora(e.target.value)
          }
        />


        <label>
          👤 Responsável pelo Lead
        </label>

        <input
          type="text"
          value={
            nomeResponsavel ||
            "Sem responsável definido"
          }
          readOnly
          disabled
        />


        <label>
          📝 Observações
        </label>

        <textarea
          rows={4}
          placeholder="Ex.: Cliente pediu para conhecer a musculação primeiro..."
          value={observacao}
          onChange={(e) =>
            setObservacao(e.target.value)
          }
        />


        <div className="leadActionButtons">

          <button
            className="btnCancelar"
            onClick={() =>
              setAberto(false)
            }
          >
            Cancelar
          </button>


          <button
            className="btnSalvar"
            onClick={agendar}
          >
            Salvar Agendamento
          </button>

        </div>

      </LeadActionModal>

    </>

  );

}
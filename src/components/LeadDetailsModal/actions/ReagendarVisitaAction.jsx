import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  atualizarVisita,
} from "../../../Agenda/VisitaEngine";

export default function ReagendarVisitaAction({
  lead,
  setLead,
}) {

  const visitaAtual =
    lead?.visita || {};


  const [aberto, setAberto] =
    useState(false);


  const [data, setData] =
    useState(
      visitaAtual.data || ""
    );


  const [hora, setHora] =
    useState(
      visitaAtual.hora || ""
    );


  const [observacao, setObservacao] =
    useState(
      visitaAtual.observacao || ""
    );


  // ============================================================
  // RESPONSÁVEL DO LEAD
  //
  // O responsável comercial é sempre o responsável ATUAL do Lead
  // (leads/{leadId}.responsavelUid). Reagendar não escolhe outro
  // consultor nem transfere o Lead.
  // ============================================================

  const nomeResponsavel =
    lead?.responsavel ||
    lead?.consultora ||
    "";


  function abrir() {

    setData(
      lead?.visita?.data || ""
    );

    setHora(
      lead?.visita?.hora || ""
    );

    setObservacao(
      lead?.visita?.observacao ||
      ""
    );

    setAberto(true);

  }


  async function reagendar() {

    if (!data || !hora) {

      alert(
        "Selecione a nova data e o horário."
      );

      return;

    }


    if (!visitaAtual.id) {

      alert(
        "Essa visita não possui um ID registrado. Será necessário criar uma nova visita."
      );

      console.error(
        "Visita sem ID:",
        visitaAtual
      );

      return;

    }


    if (!nomeResponsavel) {

      alert(
        "Este Lead ainda não possui um responsável definido. Não é possível reagendar a visita."
      );

      return;

    }


    try {

      const novaVisita = {

        id: visitaAtual.id,

        data,

        hora,

        consultor:
          nomeResponsavel,

        observacao,

      };


      // ==========================================
      // 1. ATUALIZA A VISITA EXISTENTE
      // ==========================================

      await atualizarVisita(

        visitaAtual.id,

        {

          data,

          hora,

          consultora:
            nomeResponsavel,

          observacao,

        }

      );


      // ==========================================
      // 2. ATUALIZA O LEAD
      // ==========================================

      const ultimoAtendimento =
        new Date().toLocaleString(
          "pt-BR"
        );


      await atualizarLead(

        lead.id,

        {

          visita:
            novaVisita,

          ultimoAtendimento,

        }

      );


      // ==========================================
      // 3. ATUALIZA NA TELA
      // ==========================================

      if (setLead) {

        setLead({

          ...lead,

          visita:
            novaVisita,

          ultimoAtendimento,

        });

      }


      // ==========================================
      // 4. REGISTRA HISTÓRICO
      // ==========================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "VISITA",

        usuario:
          nomeResponsavel,

        descricao:
          "Visita reagendada.",

        dados: {

          visitaAnterior:
            visitaAtual,

          novaVisita,

        },

      });


      // ==========================================
      // 5. FECHA
      // ==========================================

      setAberto(false);


      alert(
        "Visita reagendada com sucesso!"
      );


    } catch (erro) {

      console.error(
        "Erro ao reagendar visita:",
        erro
      );

      alert(
        "Não foi possível reagendar a visita."
      );

    }

  }


  return (

    <>

      <button
        className="btnAcaoPrincipal"
        onClick={abrir}
      >
        🔄 Reagendar Visita
      </button>


      <LeadActionModal
        aberto={aberto}
        titulo="Reagendar Visita"
      >

        <label>
          📅 Nova data da visita
        </label>

        <input
          type="date"
          value={data}
          onChange={(e) =>
            setData(e.target.value)
          }
        />


        <label>
          🕒 Novo horário
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
          placeholder="Ex.: Cliente pediu para remarcar..."
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
            onClick={reagendar}
          >
            🔄 Salvar Reagendamento
          </button>

        </div>

      </LeadActionModal>

    </>

  );

}
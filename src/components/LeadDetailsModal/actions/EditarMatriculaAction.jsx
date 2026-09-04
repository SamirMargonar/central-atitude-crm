import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  useAuth,
} from "../../../auth/AuthContext";


// ==========================================================
// EDITAR MATRÍCULA
// ==========================================================
//
// Corrige uma matrícula já confirmada (ex.: plano errado) sem
// criar uma nova matrícula, sem alterar a etapa do lead e sem
// tocar em confirmada/data/hora/consultor/status — só plano,
// dataInicio (com recálculo de dataVencimento) e observação.
// ==========================================================

export default function EditarMatriculaAction({
  lead,
  setLead,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [aberto, setAberto] =
    useState(false);

  const [plano, setPlano] =
    useState("MENSAL");

  const [dataInicio, setDataInicio] =
    useState("");

  const [observacao, setObservacao] =
    useState("");


  // ==========================================================
  // CALCULA DATA DE VENCIMENTO
  //
  // Mesma lógica de MatriculaAction.jsx (não alterado, não
  // importado — duplicado aqui, mesmo padrão já usado no
  // projeto para pequenas funções de data/plano).
  // ==========================================================

  function calcularVencimento(
    data,
    planoSelecionado
  ) {

    if (!data) {
      return "";
    }

    const inicio =
      new Date(
        `${data}T12:00:00`
      );

    if (
      Number.isNaN(
        inicio.getTime()
      )
    ) {

      return "";

    }


    const vencimento =
      new Date(inicio);


    if (
      planoSelecionado ===
      "MENSAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 1
      );

    }


    if (
      planoSelecionado ===
      "TRIMESTRAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 3
      );

    }


    if (
      planoSelecionado ===
      "SEMESTRAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 6
      );

    }


    if (
      planoSelecionado ===
      "ANUAL"
    ) {

      vencimento.setFullYear(
        vencimento.getFullYear() + 1
      );

    }


    const ano =
      vencimento.getFullYear();

    const mes =
      String(
        vencimento.getMonth() + 1
      ).padStart(2, "0");

    const dia =
      String(
        vencimento.getDate()
      ).padStart(2, "0");


    return `${ano}-${mes}-${dia}`;

  }


  // ==========================================================
  // FORMATA DATA
  // ==========================================================

  function formatarData(
    data
  ) {

    if (!data) {
      return "Não informada";
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
  // ABRE, PRÉ-PREENCHENDO COM OS VALORES ATUAIS
  // ==========================================================

  function abrir() {

    setPlano(
      lead?.matricula?.plano ||
      "MENSAL"
    );

    setDataInicio(
      lead?.matricula?.dataInicio ||
      ""
    );

    setObservacao(
      lead?.matricula?.observacao ||
      ""
    );

    setAberto(true);

  }


  // ==========================================================
  // SALVAR EDIÇÃO
  // ==========================================================

  async function salvarEdicao() {

    if (!plano) {

      alert(
        "Selecione o plano do cliente."
      );

      return;

    }


    if (!dataInicio) {

      alert(
        "Informe a data de início da matrícula."
      );

      return;

    }


    try {

      const matriculaAnterior =
        lead?.matricula || {};

      const dataVencimento =
        calcularVencimento(
          dataInicio,
          plano
        );


      // ========================================================
      // PRESERVA confirmada/data/hora/consultor/status — só
      // troca plano/dataInicio/dataVencimento/observacao.
      // ========================================================

      const matriculaAtualizada = {

        ...matriculaAnterior,

        plano,

        dataInicio,

        dataVencimento,

        observacao,

      };


      await atualizarLead(
        lead.id,
        {

          matricula:
            matriculaAtualizada,

        }
      );


      if (setLead) {

        setLead({

          ...lead,

          matricula:
            matriculaAtualizada,

        });

      }


      // ========================================================
      // REGISTRA NA TIMELINE
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "MATRICULA_EDITADA",

        usuario:
          nomeResponsavel,

        descricao:
          `${nomeResponsavel} editou a matrícula de ${lead.nome}.`,

        dados: {

          planoAnterior:
            matriculaAnterior.plano,

          planoNovo:
            plano,

          dataInicioAnterior:
            matriculaAnterior.dataInicio,

          dataInicioNovo:
            dataInicio,

          dataVencimentoAnterior:
            matriculaAnterior.dataVencimento,

          dataVencimentoNovo:
            dataVencimento,

        },

      });


      setAberto(false);


      alert(
        "✏️ Matrícula atualizada com sucesso!"
      );


    } catch (erro) {

      console.error(
        "Erro ao editar matrícula:",
        erro
      );

      alert(
        "Não foi possível editar a matrícula."
      );

    }

  }


  // ==========================================================
  // VENCIMENTO PREVISTO
  // ==========================================================

  const dataVencimentoPreview =
    calcularVencimento(
      dataInicio,
      plano
    );


  return (

    <>

      <button
        type="button"
        className="btnAcaoPrincipal"
        onClick={abrir}
      >
        ✏️ Editar Matrícula
      </button>


      <LeadActionModal
        aberto={aberto}
        titulo="Editar Matrícula"
      >

        <p>

          Corrija a matrícula de{" "}

          <strong>
            {lead?.nome}
          </strong>

          .

        </p>


        {/* ======================================
            PLANO
        ====================================== */}

        <label>
          🎓 Plano contratado
        </label>

        <select
          value={plano}
          onChange={(e) =>
            setPlano(
              e.target.value
            )
          }
        >

          <option value="MENSAL">
            Mensal
          </option>

          <option value="TRIMESTRAL">
            Trimestral
          </option>

          <option value="SEMESTRAL">
            Semestral
          </option>

          <option value="ANUAL">
            Anual
          </option>

        </select>


        {/* ======================================
            DATA DE INÍCIO
        ====================================== */}

        <label>
          📅 Data de início
        </label>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) =>
            setDataInicio(
              e.target.value
            )
          }
        />


        {/* ======================================
            VENCIMENTO RECALCULADO
        ====================================== */}

        <div
          style={{
            background: "#f0efff",
            borderRadius: "10px",
            padding: "14px",
            marginTop: "10px",
            marginBottom: "10px",
            border: "1px solid #d8d5ff",
          }}
        >

          <strong>
            🔄 Novo vencimento
          </strong>

          <div
            style={{
              marginTop: "7px",
              color: "#5b52e8",
              fontWeight: "700",
            }}
          >

            {formatarData(
              dataVencimentoPreview
            )}

          </div>

        </div>


        {/* ======================================
            OBSERVAÇÃO
        ====================================== */}

        <label>
          📝 Observações da matrícula
        </label>

        <textarea
          rows={5}
          placeholder="Ex.: Plano contratado, condição especial, observações..."
          value={observacao}
          onChange={(e) =>
            setObservacao(
              e.target.value
            )
          }
        />


        {/* ======================================
            BOTÕES
        ====================================== */}

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
            onClick={
              salvarEdicao
            }
          >
            ✏️ Salvar Alterações
          </button>

        </div>

      </LeadActionModal>

    </>

  );

}

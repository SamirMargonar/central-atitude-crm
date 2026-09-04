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

import {
  useAuth,
} from "../../../auth/AuthContext";

export default function MatriculaAction({
  lead,
  setLead,
  mostrarBotao = true,
  abertoExterno = false,
  fecharExterno,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  // ==========================================================
  // RESPONSÁVEL — usuário autenticado que está confirmando a
  // matrícula (não é mais um nome fixo/default).
  // ==========================================================

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";

  const [aberto, setAberto] = useState(false);


  // ============================================================
  // ABERTURA EXTERNA
  //
  // Além do próprio botão "💳 Confirmar Matrícula", este
  // formulário também pode ser aberto de fora (ex.: clique na
  // bolinha "Matrícula" da Jornada do Cliente) — sem duplicar
  // nenhuma lógica de confirmação, só reaproveitando este mesmo
  // modal. `abertoExterno` nunca é usado sozinho para fechar:
  // quem abriu de fora precisa também tratar `fecharExterno`.
  // ============================================================

  const modalAberto =
    aberto ||
    abertoExterno;


  function fecharModal() {

    setAberto(false);

    if (fecharExterno) {

      fecharExterno();

    }

  }

  const [observacao, setObservacao] = useState("");

  const [plano, setPlano] = useState("MENSAL");

  const [dataInicio, setDataInicio] = useState(() => {

    const agora = new Date();

    const ano =
      agora.getFullYear();

    const mes =
      String(
        agora.getMonth() + 1
      ).padStart(2, "0");

    const dia =
      String(
        agora.getDate()
      ).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;

  });


  // ==========================================================
  // CALCULA DATA DE VENCIMENTO
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


    // ========================================================
    // PLANO MENSAL
    // ========================================================

    if (
      planoSelecionado ===
      "MENSAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 1
      );

    }


    // ========================================================
    // PLANO TRIMESTRAL
    // ========================================================

    if (
      planoSelecionado ===
      "TRIMESTRAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 3
      );

    }


    // ========================================================
    // PLANO SEMESTRAL
    // ========================================================

    if (
      planoSelecionado ===
      "SEMESTRAL"
    ) {

      vencimento.setMonth(
        vencimento.getMonth() + 6
      );

    }


    // ========================================================
    // PLANO ANUAL
    // ========================================================

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
  // CONFIRMAR MATRÍCULA
  // ==========================================================

  async function confirmarMatricula() {

    // ==========================================================
    // VALIDAÇÃO DEFENSIVA DO OBJETIVO
    //
    // O botão que abre este modal já bloqueia antes de chegar
    // aqui, mas mantemos a mesma checagem aqui também — mesmo
    // padrão de dupla-checagem já usado em LeadTransfer.jsx
    // para permissão.
    // ==========================================================

    if (!lead?.objetivo) {

      alert(
        "⚠️ Cadastre o objetivo do Lead antes de realizar a matrícula."
      );

      return;

    }


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

      // ==========================================
      // DATA E HORA DA MATRÍCULA
      // ==========================================

      const agora =
        new Date();


      const dataMatricula =
        agora.toLocaleDateString(
          "pt-BR"
        );


      const horaMatricula =
        agora.toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );


      const ultimoAtendimento =
        agora.toLocaleString(
          "pt-BR"
        );


      // ==========================================
      // PRÓXIMA ETAPA
      // ==========================================

      const novaEtapa =
        proximaEtapa(
          ETAPAS.NEGOCIACAO
        );


      // ==========================================
      // DATA DE VENCIMENTO
      // ==========================================

      const dataVencimento =
        calcularVencimento(
          dataInicio,
          plano
        );


      // ==========================================
      // DADOS DA MATRÍCULA
      // ==========================================

      const dadosMatricula = {

        confirmada: true,

        // Registro histórico
        data:
          dataMatricula,

        hora:
          horaMatricula,

        consultor:
          nomeResponsavel,

        observacao,

        // ========================================
        // DADOS COMERCIAIS
        // ========================================

        plano,

        dataInicio,

        dataVencimento,

        status:
          "ATIVA",

      };


      // ==========================================
      // ATUALIZA LEAD NO FIREBASE
      // ==========================================

      await atualizarLead(
        lead.id,
        {

          etapa:
            novaEtapa,

          ultimoAtendimento,

          matricula:
            dadosMatricula,

        }
      );


      // ==========================================
      // ATUALIZA NA TELA
      // ==========================================

      if (setLead) {

        setLead({

          ...lead,

          etapa:
            novaEtapa,

          ultimoAtendimento,

          matricula:
            dadosMatricula,

        });

      }


      // ==========================================
      // REGISTRA MATRÍCULA NA TIMELINE
      // ==========================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "MATRICULA",

        usuario:
          nomeResponsavel,

        descricao:
          "Matrícula confirmada.",

        dados: {

          data:
            dataMatricula,

          hora:
            horaMatricula,

          consultor:
            nomeResponsavel,

          observacao,

          plano,

          dataInicio,

          dataVencimento,

        },

      });


      // ==========================================
      // REGISTRA AVANÇO DA JORNADA
      // ==========================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "JORNADA",

        usuario:
          nomeResponsavel,

        descricao:
          `${lead.nome} avançou para "${nomeDaEtapa(novaEtapa)}"`,

        dados: {

          etapaAnterior:
            ETAPAS.NEGOCIACAO,

          novaEtapa,

        },

      });


      // ==========================================
      // LIMPA FORMULÁRIO
      // ==========================================

      setObservacao("");

      setPlano("MENSAL");

      setDataInicio(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      fecharModal();


      alert(
        "🎓 Matrícula confirmada com sucesso!"
      );


    } catch (erro) {

      console.error(
        "Erro ao confirmar matrícula:",
        erro
      );

      alert(
        "Não foi possível confirmar a matrícula."
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


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      {mostrarBotao && (

        <button
          className="btnAcaoPrincipal"
          onClick={() => {

            if (!lead?.objetivo) {

              alert(
                "⚠️ Cadastre o objetivo do Lead antes de realizar a matrícula."
              );

              return;

            }

            setAberto(true);

          }}
        >
          💳 Confirmar Matrícula
        </button>

      )}


      <LeadActionModal
        aberto={modalAberto}
        titulo="Confirmar Matrícula"
      >

        <p>

          Confirme a matrícula de{" "}

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
            VENCIMENTO AUTOMÁTICO
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
            🔄 Próxima renovação
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

          <small
            style={{
              display: "block",
              marginTop: "5px",
              color: "#777",
            }}
          >

            O sistema acompanhará automaticamente
            essa data na aba de Renovações.

          </small>

        </div>


        {/* ======================================
            RESPONSÁVEL
        ====================================== */}

        <label>
          👤 Responsável
        </label>

        <input
          type="text"
          value={nomeResponsavel}
          disabled
        />


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
            onClick={() => {

              setObservacao("");

              fecharModal();

            }}
          >
            Cancelar
          </button>


          <button
            className="btnSalvar"
            onClick={
              confirmarMatricula
            }
          >
            🎓 Confirmar Matrícula
          </button>

        </div>

      </LeadActionModal>

    </>

  );

}
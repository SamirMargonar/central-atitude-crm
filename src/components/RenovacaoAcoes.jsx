import { useState } from "react";

import LeadActionModal from "./LeadDetailsModal/LeadActionModal";
import WhatsAppLivreModal from "./WhatsAppLivreModal";

import {
  atualizarLead,
  registrarEvento,
} from "../core/EventEngine";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  calcularVencimentoRenovacao,
  construirMatriculaRenovada,
  construirMatriculaComRecusa,
  construirMensagemContato,
} from "../utils/renovacaoAcoes";


export default function RenovacaoAcoes({
  cliente,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  const usuarioAtual = {

    uid:
      usuario?.uid ||
      perfilUsuario?.uid ||
      null,

    nome:
      perfilUsuario?.nome ||
      usuario?.displayName ||
      usuario?.email ||
      "Usuário",

  };


  const [modalContato, setModalContato] =
    useState(false);

  const [modalResposta, setModalResposta] =
    useState(false);

  const [modalRenovar, setModalRenovar] =
    useState(false);

  const [modalRecusar, setModalRecusar] =
    useState(false);

  const [enviando, setEnviando] =
    useState(false);

  const [plano, setPlano] =
    useState(
      cliente?.matricula?.plano || "MENSAL"
    );

  const [dataInicio, setDataInicio] =
    useState(
      cliente?.matricula?.dataVencimento || ""
    );

  const [motivo, setMotivo] =
    useState("");


  // ==========================================================
  // 1. ENTRAR EM CONTATO (WhatsApp)
  //
  // Abre o modal único de WhatsApp com a mensagem automática de
  // renovação já preenchida (editável antes de enviar). Registro
  // na Timeline e abertura do WhatsApp acontecem dentro do
  // próprio modal, ao clicar "Enviar pelo WhatsApp".
  // ==========================================================

  function abrirContato() {

    setModalContato(true);

  }


  // ==========================================================
  // 2. REGISTRAR RESPOSTA DA RENOVAÇÃO
  // ==========================================================

  async function registrarResposta(
    resposta
  ) {

    if (enviando) {
      return;
    }

    try {

      setEnviando(true);

      await registrarEvento({

        leadId: cliente.id,

        tipo: "RENOVACAO_RESPOSTA",

        usuario: usuarioAtual.nome,

        descricao:
          resposta === "POSITIVA"
            ? `${cliente.nome} demonstrou interesse em renovar.`
            : `${cliente.nome} não demonstrou interesse em renovar.`,

        dados: {
          resposta,
        },

      });

      setModalResposta(false);

    } catch (erro) {

      console.error(
        "Erro ao registrar resposta de renovação:",
        erro
      );

      alert(
        "Não foi possível registrar a resposta."
      );

    } finally {

      setEnviando(false);

    }

  }


  // ==========================================================
  // 3. RENOVAR PLANO
  // ==========================================================

  async function confirmarRenovacao() {

    if (enviando) {
      return;
    }

    if (!plano || !dataInicio) {

      alert(
        "Selecione o plano e a data de início."
      );

      return;

    }

    try {

      setEnviando(true);

      const dataVencimento =
        calcularVencimentoRenovacao(
          dataInicio,
          plano
        );

      const matriculaAtualizada =
        construirMatriculaRenovada(
          cliente.matricula || {},
          { plano, dataInicio, dataVencimento }
        );

      const agora =
        new Date().toLocaleString("pt-BR");

      await atualizarLead(
        cliente.id,
        {

          matricula: matriculaAtualizada,

          ultimoAtendimento: agora,

        }
      );

      await registrarEvento({

        leadId: cliente.id,

        tipo: "RENOVACAO_CONFIRMADA",

        usuario: usuarioAtual.nome,

        descricao:
          `${cliente.nome} renovou o plano.`,

        dados: {

          planoAnterior:
            cliente.matricula?.plano,

          planoNovo: plano,

          dataVencimentoAnterior:
            cliente.matricula?.dataVencimento,

          dataVencimentoNova: dataVencimento,

        },

      });

      setModalRenovar(false);

      alert(
        "🔄 Renovação registrada com sucesso!"
      );

    } catch (erro) {

      console.error(
        "Erro ao renovar plano:",
        erro
      );

      alert(
        "Não foi possível renovar o plano."
      );

    } finally {

      setEnviando(false);

    }

  }


  // ==========================================================
  // 4. REGISTRAR NÃO RENOVAÇÃO + MOTIVO
  //
  // NUNCA altera matricula.status — só acrescenta os campos
  // de recusa (construirMatriculaComRecusa preserva o status
  // atual, seja qual for).
  // ==========================================================

  async function confirmarRecusa() {

    if (enviando) {
      return;
    }

    if (!motivo.trim()) {

      alert(
        "Informe o motivo da não renovação."
      );

      return;

    }

    try {

      setEnviando(true);

      const agora =
        new Date().toLocaleString("pt-BR");

      const matriculaAtualizada =
        construirMatriculaComRecusa(
          cliente.matricula || {},
          {

            motivo: motivo.trim(),

            uid: usuarioAtual.uid,

            nome: usuarioAtual.nome,

            agora,

          }
        );

      await atualizarLead(
        cliente.id,
        {
          matricula: matriculaAtualizada,
        }
      );

      await registrarEvento({

        leadId: cliente.id,

        tipo: "RENOVACAO_RECUSADA",

        usuario: usuarioAtual.nome,

        descricao:
          `${cliente.nome} optou por não renovar. Motivo: ${motivo.trim()}`,

        dados: {
          motivo: motivo.trim(),
        },

      });

      setModalRecusar(false);

      setMotivo("");

    } catch (erro) {

      console.error(
        "Erro ao registrar não renovação:",
        erro
      );

      alert(
        "Não foi possível registrar a não renovação."
      );

    } finally {

      setEnviando(false);

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      <button
        type="button"
        className="btnRenovacaoContato"
        onClick={abrirContato}
        disabled={enviando}
      >
        📱 Entrar em contato
      </button>


      <WhatsAppLivreModal
        aberto={modalContato}
        fechar={() =>
          setModalContato(false)
        }
        leadId={cliente.id}
        nome={cliente.nome}
        telefone={cliente.telefone}
        mensagemInicial={construirMensagemContato(cliente)}
        tipoEvento="RENOVACAO_CONTATO"
      />


      <button
        type="button"
        className="btnRenovacaoResposta"
        onClick={() =>
          setModalResposta(true)
        }
        disabled={enviando}
      >
        💬 Registrar resposta
      </button>


      <button
        type="button"
        className="btnRenovacao"
        onClick={() =>
          setModalRenovar(true)
        }
        disabled={enviando}
      >
        🔄 Renovar plano
      </button>


      <button
        type="button"
        className="btnRenovacaoRecusar"
        onClick={() =>
          setModalRecusar(true)
        }
        disabled={enviando}
      >
        ❌ Não renovar
      </button>


      {/* ====================================================
          MODAL — RESPOSTA
      ==================================================== */}

      <LeadActionModal
        aberto={modalResposta}
        titulo="Resposta da Renovação"
      >

        <p>
          Registre a resposta de{" "}
          <strong>{cliente?.nome}</strong>.
        </p>

        <button
          type="button"
          className="btnSalvar"
          onClick={() =>
            registrarResposta("POSITIVA")
          }
          disabled={enviando}
          style={{
            width: "100%",
            marginTop: "10px",
          }}
        >
          🟢 Quer renovar
        </button>

        <button
          type="button"
          className="btnCancelar"
          onClick={() =>
            registrarResposta("NEGATIVA")
          }
          disabled={enviando}
          style={{
            width: "100%",
            marginTop: "10px",
          }}
        >
          🔴 Não quer renovar
        </button>

        <div className="leadActionButtons">
          <button
            type="button"
            className="btnCancelar"
            onClick={() =>
              setModalResposta(false)
            }
            disabled={enviando}
          >
            Fechar
          </button>
        </div>

      </LeadActionModal>


      {/* ====================================================
          MODAL — RENOVAR PLANO
      ==================================================== */}

      <LeadActionModal
        aberto={modalRenovar}
        titulo="Renovar Plano"
      >

        <p>
          Confirme a renovação de{" "}
          <strong>{cliente?.nome}</strong>.
        </p>

        <label>
          🎓 Novo plano
        </label>

        <select
          value={plano}
          onChange={(e) =>
            setPlano(e.target.value)
          }
        >
          <option value="MENSAL">Mensal</option>
          <option value="TRIMESTRAL">Trimestral</option>
          <option value="SEMESTRAL">Semestral</option>
          <option value="ANUAL">Anual</option>
        </select>

        <label>
          📅 Data de início do novo ciclo
        </label>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) =>
            setDataInicio(e.target.value)
          }
        />

        <div className="leadActionButtons">
          <button
            type="button"
            className="btnCancelar"
            onClick={() =>
              setModalRenovar(false)
            }
            disabled={enviando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btnSalvar"
            onClick={confirmarRenovacao}
            disabled={enviando}
          >
            {enviando
              ? "Salvando..."
              : "🔄 Confirmar Renovação"}
          </button>
        </div>

      </LeadActionModal>


      {/* ====================================================
          MODAL — NÃO RENOVAR
      ==================================================== */}

      <LeadActionModal
        aberto={modalRecusar}
        titulo="Não Renovação"
      >

        <p>
          Registre o motivo pelo qual{" "}
          <strong>{cliente?.nome}</strong>{" "}
          optou por não renovar.
        </p>

        <label>
          📝 Motivo
        </label>

        <textarea
          rows={4}
          placeholder="Ex.: Achou o valor alto, mudou de cidade..."
          value={motivo}
          onChange={(e) =>
            setMotivo(e.target.value)
          }
        />

        <div className="leadActionButtons">
          <button
            type="button"
            className="btnCancelar"
            onClick={() =>
              setModalRecusar(false)
            }
            disabled={enviando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btnSalvar"
            onClick={confirmarRecusa}
            disabled={enviando}
          >
            {enviando
              ? "Salvando..."
              : "❌ Confirmar Não Renovação"}
          </button>
        </div>

      </LeadActionModal>

    </>

  );

}

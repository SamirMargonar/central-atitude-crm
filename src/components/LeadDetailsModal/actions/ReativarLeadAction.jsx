import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  nomeDaEtapa,
} from "../../../core/LeadFlow";

import {
  useAuth,
} from "../../../auth/AuthContext";


// ==========================================================
// ENVIAR LEAD PARA REATIVAÇÃO
// ==========================================================
//
// STATUS ESPECIAL, não uma etapa nova — lead.etapa NUNCA é
// alterado aqui. Só grava:
//
//   status: "REATIVACAO"
//   etapaAnterior: <etapa que o lead já tinha>
//   motivoReativacao: <texto obrigatório>
//
// Mesmo padrão de todas as outras ações comerciais (Primeiro
// Contato, Resposta, Comparecimento): atualizarLead() +
// registrarEvento() de core/EventEngine.js, sem acesso direto
// ao Firestore. Usa LeadActionModal.jsx, o mesmo modal já
// reaproveitado por Consultar Lead e por todas as ações do
// LeadDetailsModal — nenhum sistema de modal novo.
// ==========================================================

export default function ReativarLeadAction({
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

  const [motivo, setMotivo] =
    useState("");

  const [enviando, setEnviando] =
    useState(false);

  const [erro, setErro] =
    useState("");


  // ==========================================================
  // Lead já em Reativação — não mostra o botão de novo (evita
  // reenviar/duplicar o motivo). Sair da Reativação fica para
  // uma fase futura, fora do escopo desta implementação.
  // ==========================================================

  if (
    lead?.status ===
    "REATIVACAO"
  ) {

    return null;

  }


  function fechar() {

    setAberto(false);

    setMotivo("");

    setErro("");

  }


  async function confirmarReativacao() {

    if (enviando) {
      return;
    }

    const motivoLimpo =
      motivo.trim();

    if (!motivoLimpo) {

      setErro(
        "Informe o motivo da reativação."
      );

      return;

    }


    try {

      setEnviando(true);

      setErro("");


      const etapaAtual =
        Number(
          lead?.etapa ?? 0
        );


      // ======================================================
      // 1. GRAVA O STATUS ESPECIAL — etapa NUNCA é tocada.
      // ======================================================

      await atualizarLead(

        lead.id,

        {

          status:
            "REATIVACAO",

          etapaAnterior:
            etapaAtual,

          motivoReativacao:
            motivoLimpo,

        }

      );


      // ======================================================
      // 2. ATUALIZA NA TELA
      // ======================================================

      if (setLead) {

        setLead({

          ...lead,

          status:
            "REATIVACAO",

          etapaAnterior:
            etapaAtual,

          motivoReativacao:
            motivoLimpo,

        });

      }


      // ======================================================
      // 3. TIMELINE — append-only, evento novo, nunca
      // sobrescreve/apaga histórico anterior.
      // ======================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "REATIVACAO",

        usuario:
          nomeResponsavel,

        descricao:
          `${lead?.nome || "Lead"} foi enviado para Reativação. Motivo: "${motivoLimpo}"`,

        dados: {

          etapaAnterior:
            etapaAtual,

          etapaAnteriorNome:
            nomeDaEtapa(etapaAtual),

          motivo:
            motivoLimpo,

        },

      });


      fechar();

    } catch (erroReativacao) {

      console.error(
        "Erro ao enviar lead para Reativação:",
        erroReativacao
      );

      setErro(
        "Não foi possível enviar o lead para Reativação."
      );

    } finally {

      setEnviando(false);

    }

  }


  return (

    <div className="leadActions">

      <button
        type="button"
        className="btnAcaoPrincipal"
        onClick={() =>
          setAberto(true)
        }
      >

        🔄 Enviar para Reativação

      </button>


      <LeadActionModal

        aberto={aberto}

        titulo="🔄 Enviar lead para Reativação"

      >

        <p>

          Por que este lead está sendo enviado para Reativação?

        </p>


        {erro && (

          <p
            style={{
              color: "#ff3b30",
              fontSize: "13px",
              fontWeight: "600",
              marginTop: "-8px",
            }}
          >

            ⚠️ {erro}

          </p>

        )}


        <textarea

          className="leadNotesInput"

          rows={5}

          placeholder='Ex.: "Achou o plano caro e pediu retorno em 2 meses."'

          value={motivo}

          onChange={(evento) =>
            setMotivo(evento.target.value)
          }

          disabled={enviando}

        />


        <div className="leadActionButtons">

          <button
            type="button"
            className="btnCancelar"
            onClick={fechar}
            disabled={enviando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btnSalvar"
            onClick={confirmarReativacao}
            disabled={
              enviando ||
              !motivo.trim()
            }
          >

            {enviando
              ? "Enviando..."
              : "Enviar para Reativação"}

          </button>

        </div>

      </LeadActionModal>

    </div>

  );

}

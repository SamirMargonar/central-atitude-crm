import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import { registrarEvento } from "../../../core/EventEngine";

import { useAuth } from "../../../auth/AuthContext";


// ==========================================================
// NÃO FECHAMENTO
//
// Registra que, na negociação, o cliente NÃO fechou a matrícula.
// É só um EVENTO novo (append-only) na timeline — não altera nenhum
// campo do lead (etapa, responsável, matrícula), então não existe
// risco de sobrescrever histórico nem de mudar a carteira. O autor
// real (UID + nome) é gravado pelo registrarEvento/Rules.
// Disponível na etapa NEGOCIAÇÃO, para a titular e para quem atende
// o lead (atendimento compartilhado).
// ==========================================================

export default function NaoFechamentoAction({
  lead,
}) {

  const { usuario, perfilUsuario } = useAuth();

  const nomeAutor =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";

  const [aberto, setAberto] = useState(false);

  const [motivo, setMotivo] = useState("");

  const [salvando, setSalvando] = useState(false);


  async function registrar() {

    if (salvando) {
      return;
    }

    if (!motivo.trim()) {
      alert("Informe o motivo do não fechamento.");
      return;
    }

    try {

      setSalvando(true);

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "NAO_FECHAMENTO",

        usuario:
          nomeAutor,

        descricao:
          motivo.trim(),

        dados: {

          atendimentoCompartilhado:
            !!lead?.responsavelUid &&
            lead.responsavelUid !== (usuario?.uid || ""),

          titularUid:
            lead?.responsavelUid || "",

          titularNome:
            lead?.responsavel || lead?.consultora || "",

          etapa:
            lead?.etapa ?? null,

        },

      });

      setMotivo("");

      setAberto(false);

      alert("Não fechamento registrado no histórico.");

    } catch (erro) {

      console.error(
        "Erro ao registrar não fechamento:",
        erro
      );

      alert("Não foi possível registrar o não fechamento.");

    } finally {

      setSalvando(false);

    }

  }


  return (
    <>

      <button
        type="button"
        className="btnAcaoPrincipal"
        onClick={() => setAberto(true)}
      >
        🚫 Registrar Não Fechamento
      </button>

      <LeadActionModal
        aberto={aberto}
        titulo="Registrar Não Fechamento"
      >

        <label>
          📝 Motivo / resultado do atendimento
        </label>

        <textarea
          rows={4}
          placeholder="Ex.: Cliente vai pensar e retorna na próxima semana..."
          value={motivo}
          onChange={(e) =>
            setMotivo(e.target.value)
          }
        />

        <div className="leadActionButtons">

          <button
            className="btnCancelar"
            onClick={() => setAberto(false)}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            className="btnSalvar"
            onClick={registrar}
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : "🚫 Registrar"}
          </button>

        </div>

      </LeadActionModal>

    </>
  );

}

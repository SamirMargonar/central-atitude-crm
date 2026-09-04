import {
  useEffect,
  useState,
} from "react";

import LeadActionModal from "./LeadDetailsModal/LeadActionModal";

import {
  registrarEvento,
} from "../core/EventEngine";

import {
  construirLinkWhatsApp,
} from "../utils/whatsapp";

import {
  useAuth,
} from "../auth/AuthContext";


// ==========================================================
// WHATSAPP — modal único e reutilizável
// ==========================================================
//
// Usado por todos os botões de WhatsApp do CRM: WhatsApp Livre
// (Dashboard/Não Compareceram, Precisa da sua Atenção, Leads/
// Não Compareceram, cabeçalho do Lead, Kanban), confirmação de
// visita e contato de renovação. Texto livre por padrão — ou
// pré-preenchido (e editável) via `mensagemInicial`, para os
// fluxos que já têm uma mensagem automática combinada. Primeiro
// Contato continua com o próprio template e fluxo separados,
// por ter regra de negócio própria (avanço de etapa, tentativas
// sem resposta).
//
// Registra a Timeline ANTES de abrir o WhatsApp, reaproveitando
// registrarEvento() — tipo configurável via `tipoEvento` (cada
// chamador pode manter seu próprio tipo já existente, como
// "RENOVACAO_CONTATO"; padrão "WHATSAPP_LIVRE"). Não registra
// como "enviado" — o CRM não tem como saber se o usuário
// realmente apertou Enviar dentro do WhatsApp.
// ==========================================================

export default function WhatsAppLivreModal({
  aberto,
  fechar,
  leadId,
  nome,
  telefone,
  mensagemInicial = "",
  tipoEvento = "WHATSAPP_LIVRE",
  dadosExtras = {},
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


  const [mensagem, setMensagem] =
    useState("");

  const [enviando, setEnviando] =
    useState(false);


  useEffect(() => {

    if (aberto) {

      setMensagem(
        mensagemInicial || ""
      );

    } else {

      setMensagem("");

    }

  }, [aberto, mensagemInicial]);


  async function abrirWhatsApp() {

    if (
      enviando ||
      !mensagem.trim()
    ) {

      return;

    }

    try {

      setEnviando(true);


      await registrarEvento({

        leadId,

        tipo:
          tipoEvento,

        usuario:
          nomeResponsavel,

        descricao:
          `Mensagem: "${mensagem}"\nUsuário: ${nomeResponsavel}`,

        dados:
          dadosExtras,

      });


      window.open(

        construirLinkWhatsApp(
          telefone,
          mensagem
        ),

        "_blank"

      );


      fechar();

    } catch (erro) {

      console.error(
        "Erro ao registrar WhatsApp:",
        erro
      );

      alert(
        "❌ Não foi possível registrar o WhatsApp."
      );

    } finally {

      setEnviando(false);

    }

  }


  return (

    <LeadActionModal

      aberto={aberto}

      titulo="💬 WhatsApp"

    >

      <p>

        <strong>{nome}</strong>
        {" — "}
        {telefone}

      </p>


      <label>

        Mensagem

      </label>

      <textarea

        rows={8}

        className="leadNotesInput"

        placeholder="Escreva a mensagem..."

        value={mensagem}

        onChange={(e) =>
          setMensagem(e.target.value)
        }

      />

      <div className="leadActionButtons">

        <button

          className="btnCancelar"

          onClick={fechar}

        >

          Cancelar

        </button>

        <button

          className="btnSalvar"

          disabled={
            enviando ||
            !mensagem.trim()
          }

          onClick={abrirWhatsApp}

        >

          {enviando
            ? "Abrindo..."
            : "Enviar pelo WhatsApp"}

        </button>

      </div>

    </LeadActionModal>

  );

}

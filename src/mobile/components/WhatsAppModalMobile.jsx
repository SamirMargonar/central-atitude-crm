import { useEffect, useState } from "react";

import "../styles/leadDetails.css";

import {
  construirLinkWhatsApp,
} from "../../utils/whatsapp.js";

import {
  registrarEvento,
} from "../../core/EventEngine.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";


// ==========================================================
// WHATSAPP — MOBILE
// ==========================================================
//
// Reaproveita construirLinkWhatsApp() (src/utils/whatsapp.js,
// não alterado) e registrarEvento() (src/core/EventEngine.js,
// não alterado) — mesmo padrão já usado pelo WhatsApp Livre do
// Desktop: registra o evento na Timeline ANTES de abrir o
// WhatsApp, nunca afirma que a mensagem foi entregue/lida. UI
// própria do Mobile, não importa WhatsAppLivreModal.jsx.
// ==========================================================

export default function WhatsAppModalMobile({
  aberto,
  fechar,
  leadId,
  nome,
  telefone,
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

    if (!aberto) {

      setMensagem("");

    }

  }, [aberto]);


  if (!aberto) {
    return null;
  }


  async function enviar() {

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
          "WHATSAPP_LIVRE",

        usuario:
          nomeResponsavel,

        descricao:
          `Mensagem: "${mensagem}"\nUsuário: ${nomeResponsavel}`,

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
        "Erro ao registrar WhatsApp (Mobile):",
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

    <div className="mobileModalOverlay">

      <div className="mobileModalCartao">

        <div className="mobileModalHeader">

          <h2>
            💬 WhatsApp
          </h2>

          <button
            type="button"
            className="mobileModalFechar"
            onClick={fechar}
          >
            ×
          </button>

        </div>


        <p className="mobileModalContato">
          <strong>{nome}</strong>
          {" — "}
          {telefone || "Não informado"}
        </p>


        <label>
          Mensagem
        </label>

        <textarea
          rows={6}
          placeholder="Escreva a mensagem..."
          value={mensagem}
          onChange={(evento) =>
            setMensagem(evento.target.value)
          }
        />


        <div className="mobileModalBotoes">

          <button
            type="button"
            className="mobileModalBotaoSecundario"
            onClick={fechar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="mobileModalBotaoPrimario"
            disabled={
              enviando ||
              !mensagem.trim()
            }
            onClick={enviar}
          >

            {enviando
              ? "Abrindo..."
              : "Enviar pelo WhatsApp"}

          </button>

        </div>

      </div>

    </div>

  );

}

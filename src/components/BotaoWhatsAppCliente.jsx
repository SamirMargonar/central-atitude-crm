import { normalizarTelefoneWhatsApp } from "../utils/whatsapp";

import "../styles/botaoWhatsAppCliente.css";

// ==========================================================
// BOTÃO "ABRIR CONVERSA NO WHATSAPP" (Agenda)
//
// Só abre a conversa com o telefone cadastrado no lead — não
// registra evento (o "WhatsApp livre" continua sendo o fluxo que
// escreve na timeline). É um link comum (<a target="_blank">):
// funciona no computador (WhatsApp Web/Desktop) e no celular (abre o
// app), sem pop-up bloqueado. Sem DDD identificável ou número em
// formato estranho, o botão fica INDISPONÍVEL com orientação — nunca
// "chuta" um DDD.
// ==========================================================

function IconeWhatsApp() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M16.04 3C9.4 3 4 8.33 4 14.9c0 2.1.56 4.15 1.62 5.95L4 28l7.35-1.9a12.1 12.1 0 0 0 4.69.94C22.68 27.04 28 21.7 28 15.14 28 8.5 22.7 3 16.04 3Zm0 21.98c-1.5 0-2.96-.4-4.24-1.16l-.3-.18-4.36 1.13 1.16-4.2-.2-.32a9.7 9.7 0 0 1-1.5-5.17c0-5.4 4.45-9.8 9.92-9.8 5.4 0 9.78 4.37 9.78 9.74 0 5.4-4.4 9.96-9.8 9.96Zm5.46-7.4c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.67-2.1-.18-.3-.02-.46.13-.6.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.25-.58-.5-.5-.68-.5h-.58c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.5.7.3 1.26.5 1.7.62.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z"
      />
    </svg>
  );
}

export default function BotaoWhatsAppCliente({ telefone }) {

  if (!String(telefone ?? "").replace(/\D/g, "")) {
    return null;
  }

  const resultado = normalizarTelefoneWhatsApp(telefone);

  if (!resultado.ok) {

    return (

      <span className="whatsAppClienteIndisponivel">

        <button
          type="button"
          className="btnWhatsAppCliente btnWhatsAppClienteOff"
          disabled
          aria-disabled="true"
          title={resultado.mensagem}
        >
          <IconeWhatsApp />
        </button>

        <small role="note" title={resultado.mensagem}>
          {resultado.mensagemCurta || resultado.mensagem}
        </small>

      </span>

    );

  }

  return (

    <a
      className="btnWhatsAppCliente"
      href={resultado.url}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir conversa no WhatsApp"
      aria-label="Abrir conversa no WhatsApp"
    >
      <IconeWhatsApp />
    </a>

  );

}

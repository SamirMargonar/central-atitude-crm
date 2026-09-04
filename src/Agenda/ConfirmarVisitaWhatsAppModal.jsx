import WhatsAppLivreModal from "../components/WhatsAppLivreModal";


// ==========================================================
// CONFIRMAR VISITA — WHATSAPP
// ==========================================================
//
// Abre DEPOIS que confirmarVisitaEngine() e o registrarEvento()
// de VISITA_CONFIRMACAO (em DetalhesVisita.jsx) já tiverem
// concluído com sucesso. É um wrapper fino sobre o modal único
// de WhatsApp (WhatsAppLivreModal), com a mensagem de confirmação
// já combinada como texto inicial — editável antes de enviar.
//
// dados.visitaId vai junto no evento da Timeline para que a
// Rule (eventoDeComparecimentoValido) reconheça este envio como
// parte do fluxo de comparecimento cross-turno, do mesmo jeito
// que já reconhece VISITA_CONFIRMACAO.
// ==========================================================

export default function ConfirmarVisitaWhatsAppModal({
  aberto,
  fechar,
  leadId,
  visitaId,
  nomeLead,
  nomeRecepcionista,
  horario,
  telefone,
}) {

  const mensagem =
    `Olá, ${nomeLead || ""}! 😊 Tudo bem? Aqui é a ${nomeRecepcionista || ""}, da Academia Viva Atitude. Estou passando para confirmar sua visita à nossa academia hoje às ${horario || ""}. Estamos te esperando! 💪🔥`;

  return (

    <WhatsAppLivreModal

      aberto={aberto}

      fechar={fechar}

      leadId={leadId}

      nome={nomeLead}

      telefone={telefone}

      mensagemInicial={mensagem}

      dadosExtras={{
        visitaId,
      }}

    />

  );

}

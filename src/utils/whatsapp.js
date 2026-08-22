// ==========================================================
// WHATSAPP — função utilitária única
//
// Antes desta extração, a mesma lógica existia duplicada em
// PrimeiroContatoAction.jsx (inline) e em
// src/utils/renovacaoAcoes.js (exportada). Esta é agora a
// única implementação — renovacaoAcoes.js reexporta esta
// função, então nenhum ponto de chamada existente precisou
// mudar.
// ==========================================================

export function construirLinkWhatsApp(
  telefone,
  mensagem
) {

  const numero =
    String(telefone || "").replace(
      /\D/g,
      ""
    );

  return `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;

}

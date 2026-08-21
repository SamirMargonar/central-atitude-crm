// ==========================================================
// NÃO COMPARECERAM — filtro puro
//
// Fonte da verdade: visitas.comparecimento === "NAO_COMPARECEU".
// Não usa lead.alertaNaoCompareceu (esse campo fica desatualizado
// após um reagendamento — ver auditoria V1.1).
// ==========================================================

export function filtrarNaoCompareceram(
  visitas
) {

  return visitas.filter(
    (visita) =>
      visita.comparecimento ===
      "NAO_COMPARECEU"
  );

}

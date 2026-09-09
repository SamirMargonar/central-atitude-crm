// ==========================================================
// NÃO COMPARECERAM — filtro puro
//
// Fonte da verdade: visitas.comparecimento === "NAO_COMPARECEU".
// Não usa lead.alertaNaoCompareceu (esse campo fica desatualizado
// após um reagendamento — ver auditoria V1.1).
//
// PENDÊNCIA OPERACIONAL (auditoria "Lead não compareceu") — uma
// visita não comparecida só sai desta lista quando
// pendenciaResolvida === true (contato registrado ou
// reagendamento). Visitas antigas, que nunca tiveram esse campo
// gravado, continuam pendentes (undefined !== true) — sem
// migração de dados.
// ==========================================================

export function filtrarNaoCompareceram(
  visitas
) {

  return visitas.filter(
    (visita) =>
      visita.comparecimento ===
        "NAO_COMPARECEU" &&
      visita.pendenciaResolvida !==
        true
  );

}

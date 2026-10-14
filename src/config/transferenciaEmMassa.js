// ==========================================================
// TRANSFERÊNCIA EM MASSA DE LEADS — IDENTIDADES AUTORIZADAS
// ==========================================================
//
// Somente estas duas contas executam transferência em massa (e a
// troca individual de responsável). São UIDs REAIS do Firebase
// Authentication (conferidos em produção em 2026-10-10) — nunca o
// campo "uid" gravado dentro de usuarios/{uid}, que pode estar errado
// (ex.: o do Naykison tem letras trocadas).
//
// ATENÇÃO — ISTO NÃO É SEGURANÇA. A lista abaixo só decide o que a
// interface mostra. A autorização de verdade é aplicada pelas
// Firestore Rules (firestore.rules → ehAutorizadoATransferirCarteira),
// que carregam a MESMA lista. Ao alterar uma, altere a outra.
// ==========================================================

export const UIDS_AUTORIZADOS_TRANSFERENCIA = Object.freeze({

  jDYvHOHYROec7Gr8DAFASz0ZfUy2:
    "Samir (administrador)",

  jLZDUG9DtlZtRhBR04pxyMUlWxj2:
    "Naykison (coordenador)",

});


// ----------------------------------------------------------
// uid = usuario.uid (Firebase Authentication)
// perfil = perfilUsuario.perfil
// ----------------------------------------------------------

export function podeTransferirEmMassa(uid, perfil) {

  return (
    !!uid &&
    Object.prototype.hasOwnProperty.call(
      UIDS_AUTORIZADOS_TRANSFERENCIA,
      uid
    ) &&
    (perfil === "admin" || perfil === "coordenador")
  );

}

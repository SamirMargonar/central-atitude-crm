import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  db,
} from "../../firebase/firebase.js";


// ==========================================================
// ASSUMIR LEAD — MOBILE
// ==========================================================
//
// Reproduz EXATAMENTE os mesmos campos que src/components/
// Leads.jsx:334-427 (assumirLead) já grava no Desktop — mesmo
// updateDoc direto em leads/{id}, sujeito às mesmas Firestore
// Rules (podeEditarLead → ehAssumirValido: só permite quando o
// lead ainda não tinha responsável, e exige que responsavelUid
// seja o uid de quem está chamando). Nenhuma regra de negócio
// nova, nenhuma alteração em firestore.rules.
// ==========================================================

export async function assumirLeadMobile(
  leadId,
  perfilUsuario
) {

  const nomeUsuario =
    perfilUsuario?.nome ||
    "";

  const uidUsuario =
    perfilUsuario?.id ||
    "";


  if (!nomeUsuario) {

    throw new Error(
      "Não foi possível identificar o usuário logado."
    );

  }


  await updateDoc(

    doc(
      db,
      "leads",
      leadId
    ),

    {

      assumido:
        true,

      responsavel:
        nomeUsuario,

      responsavelUid:
        uidUsuario,

      // Mantém "consultora" sincronizado — useLeads() usa esse
      // campo para filtrar os leads de cada recepcionista, mesmo
      // motivo documentado em Leads.jsx:397-401.
      consultora:
        nomeUsuario,

      assumidoPor:
        nomeUsuario,

      assumidoPorUid:
        uidUsuario,

      assumidoEm:
        serverTimestamp(),

    }

  );

  return {

    nomeUsuario,

    uidUsuario,

  };

}

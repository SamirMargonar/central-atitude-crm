import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

/**
 * Registra um evento na timeline do Lead
 */
export async function registrarEvento({

  leadId,

  tipo,

  usuario,

  descricao,

  dados = {},

}) {

  // Salva evento

  await addDoc(

    collection(db, "leads", leadId, "historico"),

    {

      tipo,

      usuario,

      descricao,

      dados,

      criadoEm: serverTimestamp(),

    }

  );

}

/**
 * Atualiza o Lead
 */

export async function atualizarLead(

  leadId,

  dados

) {

  await updateDoc(

    doc(db, "leads", leadId),

    dados

  );

}
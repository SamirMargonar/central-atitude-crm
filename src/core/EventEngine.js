import {
  doc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

/**
 * Atualiza os dados de um Lead
 */
export async function atualizarLead(leadId, dados) {

  if (!leadId) {
    throw new Error("ID do Lead não informado.");
  }

  const leadRef = doc(
    db,
    "leads",
    leadId
  );

  await updateDoc(
    leadRef,
    {
      ...dados,
      atualizadoEm: serverTimestamp(),
    }
  );

}


/**
 * Registra um evento no histórico do Lead
 */
export async function registrarEvento({
  leadId,
  tipo,
  usuario = "Sistema",
  descricao = "",
  dados = {},
}) {

  if (!leadId) {
    throw new Error("ID do Lead não informado.");
  }

  const eventosRef = collection(
    db,
    "leads",
    leadId,
    "eventos"
  );

  const evento = {

    leadId,

    tipo,

    usuario,

    descricao,

    dados,

    criadoEm: serverTimestamp(),

  };

  const documento = await addDoc(
    eventosRef,
    evento
  );

  return {
    id: documento.id,
    ...evento,
  };

}
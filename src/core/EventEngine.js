import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
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


/**
 * Exclui um Lead — SOMENTE o documento leads/{leadId}.
 *
 * Não exclui visitas nem eventos. Bloqueia a exclusão (erro
 * controlado, ANTES de tentar excluir) se existir qualquer
 * visita vinculada a este Lead — a permissão de acesso (quem
 * pode excluir) é decidida pelas Firestore Rules; esta função
 * decide a regra de negócio (quando é seguro excluir).
 */
export async function excluirLead(leadId) {

  if (!leadId) {
    throw new Error("ID do Lead não informado.");
  }

  const visitasVinculadas = await getDocs(
    query(
      collection(db, "visitas"),
      where("leadId", "==", leadId)
    )
  );

  if (!visitasVinculadas.empty) {

    const erro = new Error(
      "Este Lead possui visita vinculada e não pode ser excluído."
    );

    erro.codigo = "LEAD_COM_VISITA_VINCULADA";

    throw erro;

  }

  const leadRef = doc(
    db,
    "leads",
    leadId
  );

  await deleteDoc(leadRef);

}

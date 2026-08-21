import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


const visitasRef =
  collection(
    db,
    "visitas"
  );


// ==========================================================
// CRIAR VISITA
// ==========================================================

export async function criarVisita(
  visita
) {

  const novaVisita = {

    leadId:
      visita.leadId,

    leadNome:
      visita.leadNome || "",

    data:
      visita.data,

    hora:
      visita.hora,

    // ------------------------------------------------------
    // DONO ORIGINAL DO LEAD
    // ------------------------------------------------------

    consultora:
      visita.consultora || "Samir",

    // ------------------------------------------------------
    // OBSERVAÇÃO
    // ------------------------------------------------------

    observacao:
      visita.observacao || "",

    // ------------------------------------------------------
    // STATUS DA VISITA
    // ------------------------------------------------------

    status:
      "AGENDADA",

    // ------------------------------------------------------
    // CONFIRMAÇÃO
    // ------------------------------------------------------

    confirmadoPor:
      null,

    confirmadoPorNome:
      null,

    confirmadoEm:
      null,

    // ------------------------------------------------------
    // ATENDIMENTO
    // ------------------------------------------------------

    atendidoPor:
      null,

    atendidoPorNome:
      null,

    atendidoEm:
      null,

    // ------------------------------------------------------
    // COMPARECIMENTO
    // ------------------------------------------------------

    comparecimento:
      "",

    // ------------------------------------------------------
    // CRIAÇÃO
    // ------------------------------------------------------

    criadoEm:
      serverTimestamp(),

  };


  const documento =
    await addDoc(
      visitasRef,
      novaVisita
    );


  return {

    id:
      documento.id,

    ...novaVisita,

  };

}


// ==========================================================
// BUSCAR TODAS AS VISITAS
// ==========================================================

export async function buscarVisitas() {

  const consulta =
    query(
      visitasRef,
      orderBy(
        "data",
        "asc"
      )
    );


  const snapshot =
    await getDocs(
      consulta
    );


  return snapshot.docs.map(
    (documento) => ({

      id:
        documento.id,

      ...documento.data(),

    })
  );

}


// ==========================================================
// ATUALIZAR VISITA
// ==========================================================

export async function atualizarVisita(
  visitaId,
  dados
) {

  if (!visitaId) {

    throw new Error(
      "ID da visita não informado."
    );

  }


  const visitaRef =
    doc(
      db,
      "visitas",
      visitaId
    );


  await updateDoc(
    visitaRef,
    dados
  );


  return {

    id:
      visitaId,

    ...dados,

  };

}


// ==========================================================
// CONFIRMAR VISITA
// ==========================================================
//
// Essa função será usada pela recepcionista que estiver
// trabalhando no horário da visita.
//
// O DONO DO LEAD NÃO MUDA.
// ==========================================================

export async function confirmarVisita(
  visitaId,
  usuario
) {

  if (!visitaId) {

    throw new Error(
      "ID da visita não informado."
    );

  }


  const visitaRef =
    doc(
      db,
      "visitas",
      visitaId
    );


  const dados = {

    status:
      "CONFIRMADA",

    confirmadoPor:
      usuario?.uid || null,

    confirmadoPorNome:
      usuario?.nome ||
      usuario?.displayName ||
      usuario?.email ||
      "Usuário",

    confirmadoEm:
      serverTimestamp(),

  };


  await updateDoc(
    visitaRef,
    dados
  );


  return {

    id:
      visitaId,

    ...dados,

  };

}


// ==========================================================
// REGISTRAR ATENDIMENTO
// ==========================================================
//
// O usuário que realmente atender o cliente fica registrado
// separadamente do dono do Lead e de quem confirmou a visita.
// ==========================================================

export async function registrarAtendimento(
  visitaId,
  usuario,
  observacao = ""
) {

  if (!visitaId) {

    throw new Error(
      "ID da visita não informado."
    );

  }


  const visitaRef =
    doc(
      db,
      "visitas",
      visitaId
    );


  const dados = {

    atendidoPor:
      usuario?.uid || null,

    atendidoPorNome:
      usuario?.nome ||
      usuario?.displayName ||
      usuario?.email ||
      "Usuário",

    atendidoEm:
      serverTimestamp(),

    observacao:
      observacao || "",

  };


  await updateDoc(
    visitaRef,
    dados
  );


  return {

    id:
      visitaId,

    ...dados,

  };

}
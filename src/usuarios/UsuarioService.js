import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


// ==========================================================
// COLEÇÃO DE USUÁRIOS
// ==========================================================

const usuariosRef =
  collection(
    db,
    "usuarios"
  );


// ==========================================================
// BUSCAR USUÁRIO PELO UID
// ==========================================================

export async function buscarUsuario(
  uid
) {

  if (!uid) {
    return null;
  }


  const usuarioRef =
    doc(
      db,
      "usuarios",
      uid
    );


  const resultado =
    await getDoc(
      usuarioRef
    );


  if (!resultado.exists()) {
    return null;
  }


  return {

    id:
      resultado.id,

    ...resultado.data(),

  };

}


// ==========================================================
// BUSCAR TODOS OS USUÁRIOS
// ==========================================================

export async function buscarUsuarios() {

  const resultado =
    await getDocs(
      usuariosRef
    );


  return resultado.docs.map(
    (documento) => ({

      id:
        documento.id,

      ...documento.data(),

    })
  );

}


// ==========================================================
// CRIAR PERFIL DO USUÁRIO
// ==========================================================

export async function criarUsuarioPerfil({

  uid,

  nome,

  email,

  perfil = "recepcionista",

  horarioInicio = "",

  horarioFim = "",

  ativo = true,

}) {

  if (!uid) {

    throw new Error(
      "UID do usuário não informado."
    );

  }


  if (!nome) {

    throw new Error(
      "Nome do usuário não informado."
    );

  }


  const usuarioRef =
    doc(
      db,
      "usuarios",
      uid
    );


  const dados = {

    nome,

    email,

    perfil,

    horarioInicio,

    horarioFim,

    ativo,

    criadoEm:
      serverTimestamp(),

    atualizadoEm:
      serverTimestamp(),

  };


  await setDoc(
    usuarioRef,
    dados,
    {
      merge: true,
    }
  );


  return {

    id:
      uid,

    ...dados,

  };

}


// ==========================================================
// ATUALIZAR USUÁRIO
// ==========================================================

export async function atualizarUsuario(
  uid,
  dados
) {

  if (!uid) {

    throw new Error(
      "UID do usuário não informado."
    );

  }


  const usuarioRef =
    doc(
      db,
      "usuarios",
      uid
    );


  await updateDoc(
    usuarioRef,
    {

      ...dados,

      atualizadoEm:
        serverTimestamp(),

    }
  );

}
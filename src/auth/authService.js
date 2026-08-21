import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "../firebase/firebase";


// ==========================================================
// LOGIN
// ==========================================================

export async function fazerLogin(
  email,
  senha
) {

  if (!email || !senha) {

    throw new Error(
      "Informe o e-mail e a senha."
    );

  }

  try {

    const resultado =
      await signInWithEmailAndPassword(
        auth,
        email,
        senha
      );

    return resultado.user;

  } catch (erro) {

    console.error(
      "Erro ao fazer login:",
      erro
    );

    throw erro;

  }

}


// ==========================================================
// LOGOUT
// ==========================================================

export async function fazerLogout() {

  try {

    await signOut(auth);

  } catch (erro) {

    console.error(
      "Erro ao sair:",
      erro
    );

    throw erro;

  }

}
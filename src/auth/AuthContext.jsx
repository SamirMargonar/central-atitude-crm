import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  obterPermissoes,
} from "../core/Permissions";


// ==========================================================
// CONTEXTO DE AUTENTICAÇÃO
// ==========================================================

export const AuthContext =
  createContext(null);


// ==========================================================
// PROVIDER
// ==========================================================

export function AuthProvider({
  children,
}) {

  const [
    usuario,
    setUsuario,
  ] = useState(null);


  const [
    perfilUsuario,
    setPerfilUsuario,
  ] = useState(null);


  const [
    carregando,
    setCarregando,
  ] = useState(true);


  // ==========================================================
  // OBSERVA LOGIN / LOGOUT
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (usuarioAtual) => {

          try {

            setCarregando(true);


            if (!usuarioAtual) {

              setUsuario(null);

              setPerfilUsuario(null);

              setCarregando(false);

              return;

            }


            // --------------------------------------------------
            // USUÁRIO AUTENTICADO
            // --------------------------------------------------

            setUsuario(
              usuarioAtual
            );


            // --------------------------------------------------
            // BUSCA PERFIL NO FIRESTORE
            // --------------------------------------------------

            const usuarioRef =
              doc(
                db,
                "usuarios",
                usuarioAtual.uid
              );


            const resultado =
              await getDoc(
                usuarioRef
              );


            if (resultado.exists()) {

              setPerfilUsuario({

                id:
                  resultado.id,

                ...resultado.data(),

              });

            } else {

              setPerfilUsuario(null);

            }

          } catch (erro) {

            console.error(
              "Erro ao carregar perfil do usuário:",
              erro
            );

            setPerfilUsuario(null);

          } finally {

            setCarregando(false);

          }

        }
      );


    return () => {

      unsubscribe();

    };

  }, []);


  // ==========================================================
  // VALOR DO CONTEXTO
  // ==========================================================

  const valor = {

    usuario,

    perfilUsuario,

    carregando,

    autenticado:
      !!usuario,

    isAdmin:
      perfilUsuario?.perfil === "admin",

    isCoordenador:
      perfilUsuario?.perfil === "coordenador",

    isRecepcionista:
      perfilUsuario?.perfil === "recepcionista",

    permissoes:
      obterPermissoes(
        perfilUsuario?.perfil
      ),

  };


  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (

    <AuthContext.Provider
      value={valor}
    >

      {children}

    </AuthContext.Provider>

  );

}


// ==========================================================
// HOOK useAuth
// ==========================================================

export function useAuth() {

  const contexto =
    useContext(
      AuthContext
    );


  if (!contexto) {

    throw new Error(
      "useAuth deve ser usado dentro de um AuthProvider."
    );

  }


  return contexto;

}
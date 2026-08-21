import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import UsuarioModal from "./UsuarioModal";


// ==========================================================
// USUÁRIOS
// ==========================================================

export default function Usuarios() {

  const [
    usuarios,
    setUsuarios,
  ] = useState([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    modalAberto,
    setModalAberto,
  ] = useState(false);

  const [
    usuarioEditando,
    setUsuarioEditando,
  ] = useState(null);


  // ==========================================================
  // ABRIR MODAL
  // ==========================================================

  function abrirNovoUsuario() {

    setUsuarioEditando(null);

    setModalAberto(true);

  }

  function abrirEdicaoUsuario(usuario) {

    setUsuarioEditando(usuario);

    setModalAberto(true);

  }

  function fecharModalUsuario() {

    setModalAberto(false);

    setUsuarioEditando(null);

  }


  // ==========================================================
  // CARREGAR USUÁRIOS
  // ==========================================================

  useEffect(() => {

    const referencia =
      collection(
        db,
        "usuarios"
      );

    const consulta =
      query(
        referencia,
        orderBy(
          "nome",
          "asc"
        )
      );

    const unsubscribe =
      onSnapshot(
        consulta,
        (snapshot) => {

          const lista =
            snapshot.docs.map(
              (documento) => ({

                id:
                  documento.id,

                ...documento.data(),

              })
            );


          setUsuarios(lista);

          setCarregando(false);

        },

        (erro) => {

          console.error(
            "Erro ao carregar usuários:",
            erro
          );

          setCarregando(false);

        }
      );


    return () => {

      unsubscribe();

    };

  }, []);


  // ==========================================================
  // TELA
  // ==========================================================

  return (

    <div
      style={{
        padding: "32px",
      }}
    >

      {/* ==================================================
          CABEÇALHO
      ================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >

        <div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              color: "#ffffff",
            }}
          >
            👥 Usuários
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#9ca3af",
            }}
          >
            Gerencie os usuários e recepcionistas
            do Central Attitude.
          </p>

        </div>


        <button

          onClick={
            abrirNovoUsuario
          }

          style={{
            background:
              "linear-gradient(135deg, #22c55e, #16a34a)",

            color: "#ffffff",

            border: "none",

            borderRadius: "12px",

            padding: "14px 22px",

            fontSize: "15px",

            fontWeight: "700",

            cursor: "pointer",

            boxShadow:
              "0 8px 20px rgba(34,197,94,0.25)",
          }}

        >
          + Novo Usuário

        </button>

      </div>


      {/* ==================================================
          CARREGANDO
      ================================================== */}

      {carregando && (

        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "30px",
            color: "#334155",
          }}
        >
          Carregando usuários...
        </div>

      )}


      {/* ==================================================
          LISTA VAZIA
      ================================================== */}

      {!carregando &&
        usuarios.length === 0 && (

          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "40px",
              textAlign: "center",
              color: "#64748b",
            }}
          >

            <div
              style={{
                fontSize: "42px",
                marginBottom: "12px",
              }}
            >
              👤
            </div>

            <h3
              style={{
                margin: 0,
                color: "#1e293b",
              }}
            >
              Nenhum usuário cadastrado
            </h3>

            <p>
              Clique em "Novo Usuário"
              para cadastrar o primeiro funcionário.
            </p>

          </div>

        )}


      {/* ==================================================
          LISTA DE USUÁRIOS
      ================================================== */}

      {!carregando &&
        usuarios.length > 0 && (

          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >

            {usuarios.map(
              (usuario) => (

                <div
                  key={usuario.id}

                  style={{
                    background: "#ffffff",

                    borderRadius: "16px",

                    padding: "20px 24px",

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "space-between",

                    boxShadow:
                      "0 4px 18px rgba(0,0,0,0.08)",
                  }}
                >

                  {/* ==================================================
                      INFORMAÇÕES
                  ================================================== */}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >

                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #172554, #2563eb)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "22px",
                        fontWeight: "700",
                      }}
                    >
                      {(usuario.nome || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>


                    <div>

                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1e293b",
                        }}
                      >
                        {usuario.nome ||
                          "Sem nome"}
                      </div>


                      <div
                        style={{
                          marginTop: "4px",
                          color: "#64748b",
                          fontSize: "14px",
                        }}
                      >
                        {usuario.perfil ||
                          "Sem perfil"}
                      </div>

                    </div>

                  </div>


                  {/* ==================================================
                      HORÁRIO
                  ================================================== */}

                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#94a3b8",
                        marginBottom: "4px",
                      }}
                    >
                      Horário
                    </div>

                    <strong
                      style={{
                        color: "#334155",
                      }}
                    >
                      {usuario.horaEntrada &&
                      usuario.horaSaida

                        ? `${usuario.horaEntrada} → ${usuario.horaSaida}`

                        : "Não informado"}

                    </strong>

                  </div>


                  {/* ==================================================
                      STATUS
                  ================================================== */}

                  <div>

                    <span
                      style={{
                        display: "inline-block",

                        padding: "7px 13px",

                        borderRadius: "999px",

                        fontSize: "13px",

                        fontWeight: "700",

                        background:
                          usuario.ativo === false
                            ? "#fee2e2"
                            : "#dcfce7",

                        color:
                          usuario.ativo === false
                            ? "#b91c1c"
                            : "#15803d",
                      }}
                    >

                      {usuario.ativo === false
                        ? "🔴 Inativo"
                        : "🟢 Ativo"}

                    </span>

                  </div>


                  {/* ==================================================
                      EDITAR
                  ================================================== */}

                  <div>

                    <button

                      type="button"

                      onClick={() =>
                        abrirEdicaoUsuario(
                          usuario
                        )
                      }

                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        color: "#334155",
                        borderRadius: "10px",
                        padding: "9px 16px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}

                    >
                      ✏️ Editar
                    </button>

                  </div>

                </div>

              )
            )}

          </div>

        )}


      {/* ==================================================
          MODAL
      ================================================== */}

      <UsuarioModal

        aberto={modalAberto}

        fechar={fecharModalUsuario}

        usuario={usuarioEditando}

      />

    </div>

  );

}
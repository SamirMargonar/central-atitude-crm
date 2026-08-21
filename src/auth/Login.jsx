import { useState } from "react";

import { fazerLogin } from "./authService";


export default function Login() {

  const [email, setEmail] =
    useState("");

  const [senha, setSenha] =
    useState("");

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");


  // ==========================================================
  // LOGIN
  // ==========================================================

  async function entrar(e) {

    e.preventDefault();

    setErro("");


    if (!email || !senha) {

      setErro(
        "Informe o e-mail e a senha."
      );

      return;

    }


    try {

      setCarregando(true);


      await fazerLogin(
        email.trim(),
        senha
      );


      // O Firebase confirmou o login.
      // A próxima etapa será o App identificar
      // automaticamente a funcionária autenticada.


    } catch (error) {

      console.error(
        "Erro no login:",
        error
      );


      if (
        error?.code ===
        "auth/invalid-credential"
      ) {

        setErro(
          "E-mail ou senha incorretos."
        );

      }

      else if (
        error?.code ===
        "auth/user-not-found"
      ) {

        setErro(
          "Usuária não encontrada."
        );

      }

      else if (
        error?.code ===
        "auth/wrong-password"
      ) {

        setErro(
          "Senha incorreta."
        );

      }

      else if (
        error?.code ===
        "auth/too-many-requests"
      ) {

        setErro(
          "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        );

      }

      else {

        setErro(
          "Não foi possível entrar. Tente novamente."
        );

      }

    } finally {

      setCarregando(false);

    }

  }


  // ==========================================================
  // TELA
  // ==========================================================

  return (

    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #071426 0%, #0b1d36 55%, #111b32 100%)",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "22px",
          padding: "38px",
          boxSizing: "border-box",
          boxShadow:
            "0 25px 70px rgba(0,0,0,0.35)",
        }}
      >

        {/* ==================================================
            LOGO
        ================================================== */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >

          <div
            style={{
              fontSize: "42px",
              marginBottom: "8px",
            }}
          >
            🏋️
          </div>


          <h1
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "30px",
              fontWeight: "800",
              letterSpacing: "-1px",
            }}
          >
            ATTITUDE
          </h1>


          <div
            style={{
              marginTop: "2px",
              color: "#667085",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "4px",
            }}
          >
            CENTRAL
          </div>


          <p
            style={{
              marginTop: "18px",
              marginBottom: 0,
              color: "#667085",
              fontSize: "14px",
            }}
          >
            Acesse sua conta para continuar
          </p>

        </div>


        {/* ==================================================
            ERRO
        ================================================== */}

        {erro && (

          <div
            style={{
              background: "#fff1f0",
              border: "1px solid #ffccc7",
              color: "#d4380d",
              padding: "12px 14px",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >

            ⚠️ {erro}

          </div>

        )}


        {/* ==================================================
            FORMULÁRIO
        ================================================== */}

        <form onSubmit={entrar}>

          <label
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#344054",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            E-mail
          </label>


          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Digite seu e-mail"
            autoComplete="username"
            disabled={carregando}
            style={{
              width: "100%",
              height: "50px",
              padding: "0 14px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "10px",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              marginBottom: "18px",
            }}
          />


          <label
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#344054",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            Senha
          </label>


          <input
            type="password"
            value={senha}
            onChange={(e) =>
              setSenha(e.target.value)
            }
            placeholder="Digite sua senha"
            autoComplete="current-password"
            disabled={carregando}
            style={{
              width: "100%",
              height: "50px",
              padding: "0 14px",
              border:
                "1px solid #d0d5dd",
              borderRadius: "10px",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              marginBottom: "24px",
            }}
          />


          {/* ==================================================
              BOTÃO
          ================================================== */}

          <button
            type="submit"
            disabled={carregando}
            style={{
              width: "100%",
              height: "52px",
              border: "none",
              borderRadius: "11px",
              background:
                carregando
                  ? "#98a2b3"
                  : "#33cf61",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "800",
              cursor:
                carregando
                  ? "not-allowed"
                  : "pointer",
              transition:
                "all 0.2s ease",
            }}
          >

            {carregando
              ? "Entrando..."
              : "🔐 Entrar no Central Attitude"}

          </button>

        </form>


        {/* ==================================================
            RODAPÉ
        ================================================== */}

        <div
          style={{
            textAlign: "center",
            marginTop: "28px",
            color: "#98a2b3",
            fontSize: "11px",
          }}
        >

          Central Attitude • Gestão de Leads

        </div>

      </div>

    </div>

  );

}
import { useState } from "react";

import "../styles/login.css";

import {
  fazerLogin,
} from "../../auth/authService.js";


// ==========================================================
// LOGIN — MOBILE
// ==========================================================
//
// Usa a MESMA autenticação do Desktop (fazerLogin(), de
// src/auth/authService.js — não alterado). Depois do login
// confirmado pelo Firebase, o AuthContext (também não alterado)
// já identifica a funcionária autenticada automaticamente,
// exatamente como acontece no Desktop.
//
// Tela própria, em UX vertical/mobile — não reaproveita nenhum
// CSS nem JSX de src/auth/Login.jsx (Desktop).
// ==========================================================

export default function LoginScreen() {

  const [email, setEmail] =
    useState("");

  const [senha, setSenha] =
    useState("");

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");


  async function entrar(evento) {

    evento.preventDefault();

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


      // O Firebase confirmou o login — o AuthContext (mesmo do
      // Desktop) identifica a funcionária automaticamente.

    } catch (erro) {

      console.error(
        "Erro no login (Mobile):",
        erro
      );


      if (
        erro?.code ===
        "auth/invalid-credential"
      ) {

        setErro(
          "E-mail ou senha incorretos."
        );

      } else if (
        erro?.code ===
        "auth/user-not-found"
      ) {

        setErro(
          "Usuária não encontrada."
        );

      } else if (
        erro?.code ===
        "auth/wrong-password"
      ) {

        setErro(
          "Senha incorreta."
        );

      } else if (
        erro?.code ===
        "auth/too-many-requests"
      ) {

        setErro(
          "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        );

      } else {

        setErro(
          "Não foi possível entrar. Tente novamente."
        );

      }

    } finally {

      setCarregando(false);

    }

  }


  return (

    <div className="mobileLoginTela">

      <div className="mobileLoginCartao">

        <div className="mobileLoginLogo">

          <span>
            🏋️
          </span>

          <h1>
            ATTITUDE
          </h1>

          <div className="mobileLoginSubtitulo">
            CENTRAL
          </div>

          <p>
            Acesse sua conta para continuar
          </p>

        </div>


        {erro && (

          <div className="mobileLoginErro">
            ⚠️ {erro}
          </div>

        )}


        <form onSubmit={entrar}>

          <label>
            E-mail
          </label>

          <input
            type="email"
            value={email}
            onChange={(evento) =>
              setEmail(evento.target.value)
            }
            placeholder="Digite seu e-mail"
            autoComplete="username"
            disabled={carregando}
          />


          <label>
            Senha
          </label>

          <input
            type="password"
            value={senha}
            onChange={(evento) =>
              setSenha(evento.target.value)
            }
            placeholder="Digite sua senha"
            autoComplete="current-password"
            disabled={carregando}
          />


          <button
            type="submit"
            disabled={carregando}
          >

            {carregando
              ? "Entrando..."
              : "🔐 Entrar no Central Atitude"}

          </button>

        </form>


        <div className="mobileLoginRodape">
          Central Atitude • Gestão de Leads (Mobile)
        </div>

      </div>

    </div>

  );

}

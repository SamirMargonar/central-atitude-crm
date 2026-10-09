import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "../firebase/firebase";

import {
  useState,
} from "react";

import {
  useAuth,
} from "../auth/AuthContext";

import ConsultaLeadModal from "./ConsultaLeadModal";

import "../styles/sidebar.css";


export default function Sidebar({
  pagina,
  setPagina,
}) {

  const {
    perfilUsuario,
    isRecepcionista,
    isCoordenador,
    permissoes,
  } = useAuth();


  // ==========================================================
  // CONSULTAR LEAD (recepcionista consultando lead de outra
  // recepcionista; coordenador localizando qualquer lead,
  // em qualquer etapa) — ver ConsultaLeadModal.jsx /
  // useConsultaLeads.js. O que cada perfil pode FAZER no lead
  // aberto continua sendo decidido por LeadDetailsModal.jsx
  // e pelas Rules.
  // ==========================================================

  const [consultaAberta, setConsultaAberta] =
    useState(false);


  // ==========================================================
  // NAVEGAÇÃO
  // ==========================================================

  function mudarPagina(nome) {

    setPagina(nome);

  }


  // ==========================================================
  // SAIR
  // ==========================================================

  async function sair() {

    try {

      await signOut(auth);

    } catch (erro) {

      console.error(
        "Erro ao sair:",
        erro
      );

    }

  }


  return (

    <aside className="sidebar">


      {/* ==================================================
          LOGO
      ================================================== */}

      <h2 className="logo">

        🏋️ ATTITUDE

        <span>
          CENTRAL
        </span>

      </h2>


      {/* ==================================================
          USUÁRIO
      ================================================== */}

      <div
        style={{
          padding:
            "10px 18px 18px",

          color:
            "#ffffff",

          opacity:
            0.85,

          fontSize:
            "13px",
        }}
      >

        👤{" "}

        {perfilUsuario?.nome ||
          "Usuário"}

      </div>


      <nav>


        {/* ==================================================
            DASHBOARD
        ================================================== */}

        <button

          className={
            pagina === "dashboard"
              ? "menuAtivo"
              : ""
          }

          onClick={() =>
            mudarPagina("dashboard")
          }

        >

          🏠 Dashboard

        </button>


        {/* ==================================================
            LEADS
        ================================================== */}

        <button

          className={
            pagina === "leads"
              ? "menuAtivo"
              : ""
          }

          onClick={() =>
            mudarPagina("leads")
          }

        >

          👥 Leads

        </button>


        {/* ==================================================
            AGENDA
        ================================================== */}

        <button

          className={
            pagina === "agenda"
              ? "menuAtivo"
              : ""
          }

          onClick={() =>
            mudarPagina("agenda")
          }

        >

          📅 Agenda

        </button>


        {/* ==================================================
            RENOVAÇÕES
        ================================================== */}

        <button

          className={
            pagina === "renovacoes"
              ? "menuAtivo"
              : ""
          }

          onClick={() =>
            mudarPagina("renovacoes")
          }

        >

          🔄 Renovações

        </button>


        {/* ==================================================
            RELATÓRIOS
        ================================================== */}

        {permissoes.acessarRelatorios && (

          <button

            className={
              pagina === "relatorios"
                ? "menuAtivo"
                : ""
            }

            onClick={() =>
              mudarPagina("relatorios")
            }

          >

            📈 Relatórios

          </button>

        )}


        {/* ==================================================
            USUÁRIOS
            ADMIN E COORDENADOR
        ================================================== */}

        {permissoes.acessarUsuarios && (

          <button

            className={
              pagina === "usuarios"
                ? "menuAtivo"
                : ""
            }

            onClick={() =>
              mudarPagina("usuarios")
            }

          >

            👥 Usuários

          </button>

        )}


        {/* ==================================================
            CONFIGURAÇÕES
            SOMENTE ADMIN
        ================================================== */}

        {permissoes.configuracoesEstruturais && (

          <button

            className={
              pagina === "configuracoes"
                ? "menuAtivo"
                : ""
            }

            onClick={() =>
              mudarPagina("configuracoes")
            }

          >

            ⚙️ Configurações

          </button>

        )}


        {/* ==================================================
            CONSULTAR LEAD
            RECEPCIONISTA e COORDENADOR (admin continua sem o
            botão, como antes)
        ================================================== */}

        {(isRecepcionista || isCoordenador) && (

          <button

            type="button"

            onClick={() =>
              setConsultaAberta(true)
            }

          >

            🔍 Consultar Lead

          </button>

        )}

      </nav>


      {/* ==================================================
          SAIR
      ================================================== */}

      <button

        className="btnSair"

        onClick={sair}

      >

        🚪 Sair

      </button>


      <ConsultaLeadModal

        aberto={consultaAberta}

        fechar={() =>
          setConsultaAberta(false)
        }

      />


    </aside>

  );

}
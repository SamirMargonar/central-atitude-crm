import {
  useState,
} from "react";

import "./App.css";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";

import Dashboard from "./components/Dashboard";
import Leads from "./components/Leads";

import LeadModal from "./components/LeadModal";

import Calendario from "./Agenda/Calendario";

import Renovacoes from "./components/Renovacoes";

import NotificationCenter
  from "./components/NotificationCenter/NotificationCenter";

import Relatorios
  from "./components/Relatorios/Relatorios";

import Usuarios
  from "./usuarios/Usuarios";

import useLeads from "./hooks/useLeads";

import Login from "./auth/Login";

import {
  useAuth,
} from "./auth/AuthContext";


export default function App() {

  // ==========================================================
  // AUTENTICAÇÃO
  // ==========================================================

  const {
    usuario,
    carregando,
    autenticado,
    perfilUsuario,
    permissoes,
  } = useAuth();


  // ==========================================================
  // CARREGANDO AUTENTICAÇÃO
  // ==========================================================

  if (carregando) {

    return (

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #071426 0%, #0b1d36 55%, #111b32 100%)",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: "700",
        }}
      >

        Carregando Central Attitude...

      </div>

    );

  }


  // ==========================================================
  // SEM LOGIN
  // ==========================================================

  if (!autenticado) {

    return (
      <Login />
    );

  }


  // ==========================================================
  // CRM
  // ==========================================================

  return (

    <CRM

      usuario={usuario}

      perfilUsuario={perfilUsuario}

      permissoes={permissoes}

    />

  );

}


// ============================================================
// CRM PRINCIPAL
// ============================================================

function CRM({

  usuario,

  perfilUsuario,

  permissoes,

}) {

  const {
    leads,
  } = useLeads();


  // ==========================================================
  // MODAL NOVO LEAD
  // ==========================================================

  const [
    modalAberto,
    setModalAberto,
  ] = useState(false);


  // ==========================================================
  // PÁGINA ATUAL
  // ==========================================================

  const [
    pagina,
    setPagina,
  ] = useState("dashboard");


  return (

    <div className="layout">


      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <Sidebar

        pagina={pagina}

        setPagina={setPagina}

      />


      {/* ==================================================
          CONTEÚDO PRINCIPAL
      ================================================== */}

      <main className="conteudo">


        {/* ==================================================
            DASHBOARD
        ================================================== */}

        {pagina === "dashboard" && (

          <>

            <Header

              abrirModal={() =>
                setModalAberto(true)
              }

              usuario={usuario}

              perfilUsuario={perfilUsuario}

            />


            <Dashboard

              leads={leads}

            />

          </>

        )}


        {/* ==================================================
            LEADS
        ================================================== */}

        {pagina === "leads" && (

          <Leads

            leads={leads}

          />

        )}


        {/* ==================================================
            AGENDA
        ================================================== */}

        {pagina === "agenda" && (

          <Calendario

            leads={leads}

          />

        )}


        {/* ==================================================
            RENOVAÇÕES
        ================================================== */}

        {pagina === "renovacoes" && (

          <Renovacoes

            leads={leads}

            setPagina={setPagina}

          />

        )}


        {/* ==================================================
            USUÁRIOS
            ADMIN E COORDENADOR
        ================================================== */}

        {pagina === "usuarios" && permissoes.acessarUsuarios && (

          <Usuarios />

        )}


        {/* ==================================================
            RELATÓRIOS
            ADMIN, COORDENADOR E RECEPCIONISTA
            (conteúdo geral x individual ainda não implementado)
        ================================================== */}

        {pagina === "relatorios" && permissoes.acessarRelatorios && (

          <Relatorios

            leads={leads}

          />

        )}


        {/* ==================================================
            CONFIGURAÇÕES
            SOMENTE ADMIN
        ================================================== */}

        {pagina === "configuracoes" && permissoes.configuracoesEstruturais && (

          <div
            style={{
              padding: "32px",
            }}
          >

            <div
              style={{
                marginBottom: "30px",
              }}
            >

              <h1
                style={{
                  margin: 0,
                  fontSize: "32px",
                  color: "#ffffff",
                }}
              >
                ⚙️ Configurações
              </h1>

              <p
                style={{
                  marginTop: "8px",
                  color: "#9ca3af",
                }}
              >
                Administração do Central Attitude.
              </p>

            </div>


            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "28px",
                maxWidth: "700px",
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.10)",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                }}
              >

                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "16px",
                    background:
                      "linear-gradient(135deg, #172554, #2563eb)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  👥
                </div>


                <div>

                  <h2
                    style={{
                      margin: 0,
                      color: "#1e293b",
                    }}
                  >
                    Usuários
                  </h2>

                  <p
                    style={{
                      margin:
                        "6px 0 0 0",
                      color: "#64748b",
                    }}
                  >
                    Cadastre e gerencie
                    administradores e
                    recepcionistas.
                  </p>

                </div>

              </div>


              <button

                onClick={() =>
                  setPagina("usuarios")
                }

                style={{
                  marginTop: "24px",

                  width: "100%",

                  padding: "14px 18px",

                  border: "none",

                  borderRadius: "12px",

                  background:
                    "linear-gradient(135deg, #2563eb, #1d4ed8)",

                  color: "#ffffff",

                  fontSize: "15px",

                  fontWeight: "700",

                  cursor: "pointer",
                }}

              >

                👥 Gerenciar Usuários

              </button>

            </div>

          </div>

        )}


      </main>


      {/* ==================================================
          MODAL NOVO LEAD
      ================================================== */}

      <LeadModal

        aberto={modalAberto}

        fechar={() =>
          setModalAberto(false)
        }

      />


      {/* ==================================================
          CENTRAL GLOBAL DE NOTIFICAÇÕES
      ================================================== */}

      <NotificationCenter

        leads={leads}

        setPagina={setPagina}

      />


    </div>

  );

}
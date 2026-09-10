import { useState } from "react";

import "./styles/shell.css";

import LoginScreen from "./screens/LoginScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import LeadsScreen from "./screens/LeadsScreen.jsx";
import AgendaScreen from "./screens/AgendaScreen.jsx";

import BottomNavigation from "./components/BottomNavigation.jsx";

import {
  useAuth,
} from "../auth/AuthContext.jsx";


// ==========================================================
// SHELL DO MOBILE
// ==========================================================
//
// Mesma separação carregando/autenticado que App.jsx já usa no
// Desktop, reaproveitando o MESMO useAuth() (AuthContext.jsx
// não é tocado) — só a apresentação é própria do Mobile.
//
// Navegação: nesta fase, sem react-router-dom — só um useState
// interno ("tela"), no mesmo espírito do "pagina"/"setPagina"
// que o Desktop já usa em App.jsx (padrão reaproveitado, não o
// arquivo).
// ==========================================================

export default function AppMobile() {

  const {
    carregando,
    autenticado,
    usuario,
    perfilUsuario,
  } = useAuth();


  const [tela, setTela] =
    useState("inicio");


  // ==========================================================
  // CARREGANDO AUTENTICAÇÃO
  // ==========================================================

  if (carregando) {

    return (

      <div className="mobileCarregando">

        Carregando Central Atitude...

      </div>

    );

  }


  // ==========================================================
  // SEM LOGIN
  // ==========================================================

  if (!autenticado) {

    return (
      <LoginScreen />
    );

  }


  // ==========================================================
  // APP MOBILE
  // ==========================================================

  return (

    <div className="mobileShell">

      <div className="mobileConteudo">

        {tela === "inicio" && (

          <DashboardScreen
            usuario={usuario}
            perfilUsuario={perfilUsuario}
            onNavegar={setTela}
          />

        )}


        {tela === "leads" && (

          <LeadsScreen />

        )}


        {tela === "agenda" && (

          <AgendaScreen />

        )}


        {tela !== "inicio" &&
          tela !== "leads" &&
          tela !== "agenda" && (

          <div className="mobileEmConstrucao">

            <span className="mobileEmConstrucaoIcone">
              🚧
            </span>

            <h2>
              Em construção
            </h2>

            <p>
              Esta área do Mobile ainda
              será implementada numa
              próxima fase.
            </p>

          </div>

        )}

      </div>


      <BottomNavigation

        telaAtual={tela}

        onMudarTela={setTela}

      />

    </div>

  );

}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/shell.css";

import AppMobile from "./AppMobile.jsx";

import {
  AuthProvider,
} from "../auth/AuthContext.jsx";


// ==========================================================
// ROOT PRÓPRIO DO MOBILE
// ==========================================================
//
// Espelha exatamente o padrão de src/main.jsx (mesmo
// AuthProvider, mesma árvore de autenticação), mas monta uma
// aplicação irmã (AppMobile), nunca o App do Desktop. Este
// arquivo só é carregado a partir de index-mobile.html — nunca
// pelo index.html do Desktop.
// ==========================================================

createRoot(
  document.getElementById("root")
).render(

  <StrictMode>

    <AuthProvider>

      <AppMobile />

    </AuthProvider>

  </StrictMode>

);

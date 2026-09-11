import { useState } from "react";

import "../styles/leads.css";

import "../styles/leadActions.css";

import {
  nomeDaEtapa,
} from "../../core/LeadFlow.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";

import {
  assumirLeadMobile,
} from "../services/assumirLeadMobile.js";


// ==========================================================
// CARD DE LEAD — MOBILE
// ==========================================================
//
// Componente próprio do Mobile — não importa LeadCard.jsx nem
// nenhum CSS do Desktop. Mostra só os campos já existentes no
// documento do lead (nada inventado): nome, telefone, objetivo,
// origem, etapa (nomeDaEtapa, de core/LeadFlow.js) e o estado
// assumido/aguardando (lead.assumido, mesmo campo que o Desktop
// já usa em toda parte).
//
// "Assumir Lead": mesmo padrão do Kanban Desktop (LeadCard.jsx)
// — um botão PRÓPRIO, irmão (nunca aninhado) do botão que abre
// os detalhes, para não violar HTML (<button> dentro de
// <button> é inválido). Por isso o card deixou de ser ele mesmo
// um <button> e virou um <div>; o "abrir detalhes" agora é um
// <button> interno cobrindo a área de conteúdo (reset inline,
// sem CSS novo em leads.css). Sem atualização otimista aqui —
// useLeads() é um listener em tempo real, o card reflete sozinho
// assim que o Firestore confirma a escrita, mesmo comportamento
// do Kanban Desktop.
// ==========================================================

export default function LeadCardMobile({
  lead,
  onClick,
}) {

  const {
    perfilUsuario,
  } = useAuth();


  const [assumindo, setAssumindo] =
    useState(false);

  const [erroAssumir, setErroAssumir] =
    useState("");


  const etapa =
    Number(
      lead?.etapa ?? 0
    );


  const aguardando =
    !lead?.assumido;


  async function assumir() {

    if (assumindo) {
      return;
    }

    try {

      setAssumindo(true);

      setErroAssumir("");

      await assumirLeadMobile(
        lead.id,
        perfilUsuario
      );

    } catch (erro) {

      console.error(
        "Erro ao assumir Lead (Mobile):",
        erro
      );

      setErroAssumir(
        "Não foi possível assumir este lead."
      );

    } finally {

      setAssumindo(false);

    }

  }


  return (

    <div className="mobileLeadCard">

      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          border: "none",
          background: "none",
          padding: 0,
          margin: 0,
          textAlign: "left",
          font: "inherit",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >

      <div className="mobileLeadCardTopo">

        <strong className="mobileLeadCardNome">
          {lead?.nome || "Lead"}
        </strong>

        <span
          className={`
            mobileLeadCardStatus
            ${
              aguardando
                ? "mobileLeadCardStatusAguardando"
                : "mobileLeadCardStatusAssumido"
            }
          `}
        >

          {aguardando
            ? "🆕 Aguardando"
            : "🤝 Em atendimento"}

        </span>

      </div>


      <div className="mobileLeadCardInfo">

        <span>
          📞{" "}
          {lead?.telefone ||
            "Não informado"}
        </span>

        {lead?.objetivo && (

          <span>
            🎯{" "}
            {lead.objetivo}
          </span>

        )}

        {lead?.origem && (

          <span>
            📍{" "}
            {lead.origem}
          </span>

        )}

      </div>


      <div className="mobileLeadCardRodape">

        <span className="mobileLeadCardEtapa">
          {nomeDaEtapa(etapa)}
        </span>

      </div>

      </button>


      {aguardando && (

        <>

          <button
            type="button"
            className="mobileAcaoPrimaria"
            onClick={assumir}
            disabled={assumindo}
          >

            {assumindo
              ? "Assumindo..."
              : "🤝 Assumir Lead"}

          </button>


          {erroAssumir && (

            <p className="mobileAcaoErro">
              ⚠️ {erroAssumir}
            </p>

          )}

        </>

      )}

    </div>

  );

}

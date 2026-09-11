import { useState } from "react";

import "../styles/leadActions.css";

import {
  ETAPAS,
} from "../../core/LeadFlow.js";

import {
  useAuth,
} from "../../auth/AuthContext.jsx";

import {
  assumirLeadMobile,
} from "../services/assumirLeadMobile.js";

import PrimeiroContatoActionMobile from "./PrimeiroContatoActionMobile.jsx";
import RespostaActionMobile from "./RespostaActionMobile.jsx";


// ==========================================================
// AÇÕES DO LEAD — MOBILE (dispatcher por etapa)
// ==========================================================
//
// Réplica funcional de LeadActions.jsx + o cálculo de podeAgir/
// souDonoDoLead que LeadDetailsModal.jsx (Desktop) já faz antes
// de renderizar LeadActions — mesmo critério, replicado aqui só
// para decidir O QUE MOSTRAR no cliente (as Firestore Rules
// continuam sendo a autoridade real de segurança, não alteradas).
//
// "Assumir Lead" não existe em LeadActions.jsx (no Desktop é um
// botão do Kanban, em Leads.jsx) — aqui vira o primeiro degrau
// do dispatcher: lead sem responsável primeiro precisa ser
// assumido antes de qualquer ação de etapa ficar disponível,
// exatamente como já acontece no Desktop (souDonoDoLead só fica
// true depois de assumirLead()).
//
// Etapas além de RECEBIDO/CONTATO (Visita, Negociação,
// Matrícula) ainda não têm ação no Mobile nesta fase — mensagem
// neutra, sem inventar comportamento.
// ==========================================================

export default function LeadActionsMobile({
  lead,
  setLead,
}) {

  const {
    perfilUsuario,
    isAdmin,
    isCoordenador,
  } = useAuth();


  const [assumindo, setAssumindo] =
    useState(false);

  const [erroAssumir, setErroAssumir] =
    useState("");


  const souDonoDoLead =
    !!perfilUsuario &&
    (
      lead?.responsavelUid === perfilUsuario?.id ||
      lead?.consultora === perfilUsuario?.nome ||
      lead?.responsavel === perfilUsuario?.nome
    );

  const podeAgir =
    isAdmin ||
    isCoordenador ||
    souDonoDoLead;


  async function assumir() {

    if (assumindo) {
      return;
    }

    try {

      setAssumindo(true);

      setErroAssumir("");


      const {
        nomeUsuario,
        uidUsuario,
      } = await assumirLeadMobile(
        lead.id,
        perfilUsuario
      );


      if (setLead) {

        setLead({

          ...lead,

          assumido:
            true,

          responsavel:
            nomeUsuario,

          responsavelUid:
            uidUsuario,

          consultora:
            nomeUsuario,

          assumidoPor:
            nomeUsuario,

          assumidoPorUid:
            uidUsuario,

        });

      }

    } catch (erro) {

      console.error(
        "Erro ao assumir Lead (Mobile):",
        erro
      );

      setErroAssumir(
        "Não foi possível assumir este lead. Tente novamente."
      );

    } finally {

      setAssumindo(false);

    }

  }


  // ==========================================================
  // LEAD SEM RESPONSÁVEL — precisa ser assumido primeiro
  // ==========================================================

  if (!lead?.assumido) {

    return (

      <section className="mobileLeadDetalheSecao">

        <h2>
          🆕 Lead sem responsável
        </h2>

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

      </section>

    );

  }


  // ==========================================================
  // MODO CONSULTA — lead já assumido por outra pessoa
  // ==========================================================

  if (!podeAgir) {

    return (

      <section className="mobileLeadDetalheSecao">

        <h2>
          🔍 Modo consulta
        </h2>

        <p className="mobileAcaoConsulta">
          Este lead é de outro responsável. Ações de
          edição estão desabilitadas.
        </p>

      </section>

    );

  }


  // ==========================================================
  // AÇÃO POR ETAPA
  // ==========================================================

  const etapa =
    Number(
      lead?.etapa ??
      ETAPAS.RECEBIDO
    );


  if (
    etapa === ETAPAS.RECEBIDO
  ) {

    return (

      <PrimeiroContatoActionMobile
        lead={lead}
        setLead={setLead}
      />

    );

  }


  if (
    etapa === ETAPAS.CONTATO
  ) {

    return (

      <RespostaActionMobile
        lead={lead}
        setLead={setLead}
      />

    );

  }


  return (

    <section className="mobileLeadDetalheSecao">

      <h2>
        ✅ Jornada em andamento
      </h2>

      <p className="mobileAcaoConsulta">
        Ação para esta etapa ainda não disponível no Mobile.
      </p>

    </section>

  );

}

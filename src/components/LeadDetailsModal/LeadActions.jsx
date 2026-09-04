import { ETAPAS } from "../../core/LeadFlow";

import PrimeiroContatoAction
  from "./actions/PrimeiroContatoAction";

import RespostaAction
  from "./actions/RespostaAction";

import AgendarVisitaAction
  from "./actions/AgendarVisitaAction";

import ReagendarVisitaAction
  from "./actions/ReagendarVisitaAction";

import ComparecimentoAction
  from "./actions/ComparecimentoAction";

import MatriculaAction
  from "./actions/MatriculaAction";

import EditarMatriculaAction
  from "./actions/EditarMatriculaAction";


export default function LeadActions({
  lead,
  setLead,
}) {

  // ==========================================================
  // ETAPA ATUAL DO LEAD
  // ==========================================================
  //
  // O Firestore pode entregar o valor como número.
  // Também deixamos preparado caso venha como string.
  //
  // Exemplo:
  // etapa: 5
  // etapa: "5"
  //
  // Ambos serão tratados como:
  // ETAPAS.MATRICULA
  // ==========================================================

  const etapa = Number(
    lead?.etapa ?? ETAPAS.RECEBIDO
  );


  // ==========================================================
  // ① RECEBIDO
  // ==========================================================

  if (
    etapa === ETAPAS.RECEBIDO
  ) {

    return (

      <PrimeiroContatoAction
        lead={lead}
        setLead={setLead}
      />

    );

  }


  // ==========================================================
  // ② CONTATO
  // ==========================================================

  if (
    etapa === ETAPAS.CONTATO
  ) {

    return (

      <RespostaAction
        lead={lead}
        setLead={setLead}
      />

    );

  }


  // ==========================================================
  // ③ RESPOSTA
  // ==========================================================

  if (
    etapa === ETAPAS.RESPOSTA
  ) {

    return (

      <AgendarVisitaAction
        lead={lead}
        setLead={setLead}
      />

    );

  }


  // ==========================================================
  // ④ VISITA
  // ==========================================================

  if (
    etapa === ETAPAS.VISITA
  ) {

    return (

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >

        <ReagendarVisitaAction
          lead={lead}
          setLead={setLead}
        />

        <ComparecimentoAction
          lead={lead}
          setLead={setLead}
        />

      </div>

    );

  }


  // ==========================================================
  // ⑤ NEGOCIAÇÃO
  // ==========================================================

  if (
    etapa === ETAPAS.NEGOCIACAO
  ) {

    return (

      <MatriculaAction
        lead={lead}
        setLead={setLead}
      />

    );

  }


  // ==========================================================
  // ⑥ MATRÍCULA
  // ==========================================================
  //
  // IMPORTANTE:
  //
  // Matrícula é a última etapa da jornada.
  //
  // O Lead NÃO deve ser removido.
  // O Lead NÃO deve voltar para Recebido.
  // O Lead continua no Firestore com:
  //
  // etapa: 5
  //
  // Aqui apenas mostramos que a jornada terminou.
  // ==========================================================

  if (
    etapa === ETAPAS.MATRICULA
  ) {

    return (

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >

        <button
          type="button"
          className="btnAcaoPrincipal"
          disabled
        >

          ✅ Jornada Finalizada

        </button>

        <EditarMatriculaAction
          lead={lead}
          setLead={setLead}
        />

      </div>

    );

  }


  // ==========================================================
  // FALLBACK
  // ==========================================================
  //
  // Caso exista algum Lead com uma etapa inválida,
  // não fazemos nenhuma alteração no banco.
  // ==========================================================

  return (

    <button
      type="button"
      className="btnAcaoPrincipal"
      disabled
    >

      ✅ Jornada Finalizada

    </button>

  );

}
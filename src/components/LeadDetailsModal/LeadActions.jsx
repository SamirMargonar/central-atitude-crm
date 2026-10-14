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

import NaoFechamentoAction
  from "./actions/NaoFechamentoAction";


export default function LeadActions({
  lead,
  setLead,
  podeAgir = true,
  modoCompartilhado = false,
}) {

  // ==========================================================
  // MODO CONSULTA
  //
  // Nenhuma das ações abaixo depende só da etapa — todas
  // exigem ser dona do lead (ou admin/coordenador) nas Rules.
  // Em vez de mostrar um botão que hoje já falharia, mostramos
  // uma mensagem neutra.
  // ==========================================================

  // ==========================================================
  // ATENDIMENTO COMPARTILHADO
  //
  // Recepcionista ATIVA atendendo o lead de outra consultora
  // (a propriedade NÃO muda). Só as operações explicitamente
  // autorizadas nas Firestore Rules aparecem, por etapa:
  //   VISITA      → reagendar visita / registrar comparecimento
  //   NEGOCIAÇÃO  → confirmar matrícula (fluxo oficial) /
  //                 registrar não fechamento
  // Observações ficam em LeadNotes. As Rules são a autoridade;
  // aqui só evitamos botões que seriam negados.
  // ==========================================================

  if (!podeAgir && modoCompartilhado) {

    const etapaCompartilhada = Number(
      lead?.etapa ?? ETAPAS.RECEBIDO
    );

    if (
      lead?.status === "REATIVACAO" ||
      (
        etapaCompartilhada !== ETAPAS.VISITA &&
        etapaCompartilhada !== ETAPAS.NEGOCIACAO
      )
    ) {

      return (

        <div className="leadActions">

          <button
            type="button"
            className="btnAcaoPrincipal"
            disabled
          >
            🤝 Atendimento compartilhado — nenhuma ação
            disponível nesta etapa (use as observações)
          </button>

        </div>

      );

    }

    return (

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >

        {etapaCompartilhada === ETAPAS.VISITA && (
          <>
            <ReagendarVisitaAction
              lead={lead}
              setLead={setLead}
            />
            <ComparecimentoAction
              lead={lead}
              setLead={setLead}
            />
          </>
        )}

        {etapaCompartilhada === ETAPAS.NEGOCIACAO && (
          <>
            <MatriculaAction
              lead={lead}
              setLead={setLead}
            />
            <NaoFechamentoAction
              lead={lead}
            />
          </>
        )}

      </div>

    );

  }


  if (!podeAgir) {

    return (

      <div className="leadActions">

        <button
          type="button"
          className="btnAcaoPrincipal"
          disabled
        >
          🔍 Modo consulta — ação disponível apenas para o
          responsável pelo lead
        </button>

      </div>

    );

  }


  // ==========================================================
  // LEAD EM REATIVAÇÃO — STATUS ESPECIAL
  //
  // Não é uma etapa (lead.etapa continua intocado) — só troca
  // a ação principal normal da etapa por um aviso, já que o
  // lead está fora do fluxo comercial ativo neste momento. A
  // opção de reativar/enviar para Reativação fica em
  // ReativarLeadAction.jsx (renderizado à parte, em
  // LeadDetailsModal.jsx).
  // ==========================================================

  if (
    lead?.status ===
    "REATIVACAO"
  ) {

    return (

      <div className="leadActions">

        <button
          type="button"
          className="btnAcaoPrincipal"
          disabled
        >
          🔄 Lead em Reativação — fora do fluxo comercial ativo
        </button>

      </div>

    );

  }


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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >

        <MatriculaAction
          lead={lead}
          setLead={setLead}
        />

        <NaoFechamentoAction
          lead={lead}
        />

      </div>

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
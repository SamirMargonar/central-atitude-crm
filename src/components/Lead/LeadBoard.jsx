import LeadCard from "./LeadCard";
import "../../styles/LeadBoard.css";
import { ETAPAS } from "../../core/LeadFlow";

export default function LeadBoard({
  leads,
  onAssumir,
  onVerHistorico,
}) {

  // ==========================================
  // SEPARA OS LEADS POR ETAPA
  // ==========================================

  const recebidos = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.RECEBIDO
    );

  });


  const primeiroContato = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.CONTATO &&
      !lead.semResposta
    );

  });


  const semResposta = leads.filter((lead) => {

    return lead.semResposta === true;

  });


  const respostas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.RESPOSTA
    );

  });


  const visitas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.VISITA
    );

  });


  const negociacoes = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.NEGOCIACAO
    );

  });


  const matriculas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.MATRICULA
    );

  });


  // ==========================================
  // VERIFICA SE EXISTE COLUNA SEM RESPOSTA
  // ==========================================

  const temSemResposta =
    semResposta.length > 0;


  // ==========================================
  // RENDERIZA UMA COLUNA
  // ==========================================

  function Coluna({
    titulo,
    icone,
    lista,
  }) {

    return (

      <div className="leadColumn">

        <div className="leadColumnHeader">

          {icone} {titulo} ({lista.length})

        </div>


        <div className="leadColumnContent">

          {lista.length === 0 ? (

            <div className="leadColumnVazia">

              Nenhum lead nesta etapa.

            </div>

          ) : (

            lista.map((lead) => (

              <LeadCard
                key={lead.id}
                lead={lead}
                onAssumir={onAssumir}
                onVerHistorico={onVerHistorico}
              />

            ))

          )}

        </div>

      </div>

    );

  }


  // ==========================================
  // RENDER
  // ==========================================

  return (

    <section
      className={`leadBoard ${
        temSemResposta
          ? "leadBoardComSemResposta"
          : ""
      }`}
    >

      <Coluna
        titulo="Recebidos"
        icone="📥"
        lista={recebidos}
      />


      <Coluna
        titulo="Primeiro Contato"
        icone="📞"
        lista={primeiroContato}
      />


      <Coluna
        titulo="Resposta"
        icone="💬"
        lista={respostas}
      />


      {temSemResposta && (

        <Coluna
          titulo="Sem Resposta"
          icone="❌"
          lista={semResposta}
        />

      )}


      <Coluna
        titulo="Visitas"
        icone="📅"
        lista={visitas}
      />


      <Coluna
        titulo="Negociação"
        icone="💰"
        lista={negociacoes}
      />


      <Coluna
        titulo="Matrícula"
        icone="🎓"
        lista={matriculas}
      />

    </section>

  );

}
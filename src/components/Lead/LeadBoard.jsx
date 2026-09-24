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
  //
  // Lead em Reativação (status:"REATIVACAO") sai de TODAS as
  // colunas comerciais normais, mesmo mantendo `etapa` intocada
  // por baixo — mesmo princípio já usado por "Sem Resposta"
  // (leads.semResposta), só que aplicado a todas as colunas em
  // vez de só "Primeiro Contato".
  // ==========================================

  const emReativacao = (lead) =>
    lead.status === "REATIVACAO";


  const recebidos = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.RECEBIDO &&
      !emReativacao(lead)
    );

  });


  const primeiroContato = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.CONTATO &&
      !lead.semResposta &&
      !emReativacao(lead)
    );

  });


  const semResposta = leads.filter((lead) => {

    return (
      lead.semResposta === true &&
      !emReativacao(lead)
    );

  });


  const respostas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.RESPOSTA &&
      !emReativacao(lead)
    );

  });


  const visitas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.VISITA &&
      !emReativacao(lead)
    );

  });


  const negociacoes = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.NEGOCIACAO &&
      !emReativacao(lead)
    );

  });


  const matriculas = leads.filter((lead) => {

    return (
      (lead.etapa ?? ETAPAS.RECEBIDO) ===
      ETAPAS.MATRICULA &&
      !emReativacao(lead)
    );

  });


  const reativacao = leads.filter(emReativacao);


  // ==========================================
  // VERIFICA SE EXISTEM COLUNAS EXTRAS
  // ==========================================

  const temSemResposta =
    semResposta.length > 0;

  const temReativacao =
    reativacao.length > 0;


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

  const totalColunas =
    6 +
    (temSemResposta ? 1 : 0) +
    (temReativacao ? 1 : 0);

  return (

    <section
      className={`leadBoard ${
        temSemResposta
          ? "leadBoardComSemResposta"
          : ""
      }`}
      style={{
        gridTemplateColumns:
          `repeat(${totalColunas}, minmax(0, 1fr))`,
      }}
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


      {temReativacao && (

        <Coluna
          titulo="Reativação"
          icone="🔄"
          lista={reativacao}
        />

      )}

    </section>

  );

}
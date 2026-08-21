import LeadTimer from "./LeadTimer";
import { ETAPAS, nomeDaEtapa } from "../../core/LeadFlow";

export default function LeadCard({
  lead,
  onAssumir,
  onVerHistorico,
}) {

  const etapa =
    lead.etapa ?? ETAPAS.RECEBIDO;


  // ==========================================
  // LEAD SEM RESPOSTA
  // ==========================================

  const semResposta =
    lead.semResposta === true;


  // ==========================================
  // FORMATA PRÓXIMA TENTATIVA
  // ==========================================

  function formatarProximaTentativa() {

    if (
      !lead.proximaTentativaEm
    ) {
      return null;
    }


    let data;


    // Firebase Timestamp
    if (
      typeof lead.proximaTentativaEm?.toDate ===
      "function"
    ) {

      data =
        lead.proximaTentativaEm.toDate();

    }

    // Timestamp bruto
    else if (
      lead.proximaTentativaEm?.seconds
    ) {

      data =
        new Date(
          lead.proximaTentativaEm.seconds *
          1000
        );

    }

    else {

      data =
        new Date(
          lead.proximaTentativaEm
        );

    }


    if (
      isNaN(data.getTime())
    ) {

      return null;

    }


    return data.toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );

  }


  const proximaTentativa =
    formatarProximaTentativa();


  // ==========================================
  // TEXTO DO BOTÃO PRINCIPAL
  // ==========================================

  function textoBotao() {

    if (!lead.assumido) {

      return "Assumir Lead";

    }


    switch (etapa) {

      case ETAPAS.RECEBIDO:

        return "📞 Registrar Primeiro Contato";


      case ETAPAS.CONTATO:

        return "📅 Agendar Visita";


      case ETAPAS.RESPOSTA:

        return "📅 Agendar Visita";


      case ETAPAS.VISITA:

        return "🏋 Registrar Comparecimento";


      case ETAPAS.NEGOCIACAO:

        return "💳 Confirmar Matrícula";


      case ETAPAS.MATRICULA:

        return "✅ Jornada Finalizada";


      default:

        return "✅ Jornada Finalizada";

    }

  }


  return (

    <div
      className={
        !lead.assumido
          ? "leadCard novoLead"
          : "leadCard"
      }
    >

      {/* =====================================
          NOME
      ===================================== */}

      <h2>
        {lead.nome}
      </h2>


      {/* =====================================
          CRONÔMETRO
      ===================================== */}

      <LeadTimer
        createdAt={lead.createdAt}
      />


      {/* =====================================
          DADOS DO LEAD
      ===================================== */}

      <p>
        📞 {lead.telefone}
      </p>


      <p>
        🎂 {lead.idade} anos
      </p>


      <p>
        🎯 {lead.objetivo}
      </p>


      <p>
        📍 {lead.origem}
      </p>


      {/* =====================================
          SEM RESPOSTA
      ===================================== */}

      {semResposta ? (

        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "10px",
            background: "#fff5f5",
            border: "1px solid #ffd0d0",
          }}
        >

          <strong
            style={{
              display: "block",
              color: "#ff3b30",
              marginBottom: "6px",
            }}
          >

            ❌ Sem Resposta

          </strong>


          <span
            style={{
              display: "block",
              fontSize: "13px",
              color: "#555",
            }}
          >

            🔁{" "}
            {lead.tentativasSemResposta || 0}
            {" "}
            tentativas realizadas

          </span>


          {proximaTentativa && (

            <span
              style={{
                display: "block",
                fontSize: "13px",
                color: "#777",
                marginTop: "5px",
              }}
            >

              📅 Próximo contato:{" "}
              <strong>
                {proximaTentativa}
              </strong>

            </span>

          )}

        </div>

      ) : (

        /* ===================================
           STATUS NORMAL
        =================================== */

        <div className="status">

          {nomeDaEtapa(etapa)}

        </div>

      )}


      {/* =====================================
          AÇÕES
      ===================================== */}

      <div className="acoes">


        {/* =====================================
            LEAD AINDA NÃO ASSUMIDO
        ===================================== */}

        {!lead.assumido ? (

          <button
            className="btnAzul"
            onClick={() =>
              onAssumir(lead.id)
            }
          >

            Assumir Lead

          </button>

        ) : (

          /* ===================================
             LEAD JÁ ASSUMIDO
          =================================== */

          <button
            className="btnAzul"
            onClick={() =>
              onVerHistorico(lead)
            }
          >

            {textoBotao()}

          </button>

        )}


        {/* =====================================
            HISTÓRICO
        ===================================== */}

        <button
          className="btnHistorico"
          onClick={() =>
            onVerHistorico(lead)
          }
        >

          Ver Histórico

        </button>


        {/* =====================================
            WHATSAPP
        ===================================== */}

        <a
          href={`https://wa.me/55${String(
            lead.telefone || ""
          ).replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >

          <button className="btnVerde">

            WhatsApp

          </button>

        </a>


      </div>

    </div>

  );

}
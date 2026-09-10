import { useState } from "react";

import "../styles/leadDetails.css";

import {
  JORNADA,
} from "../../core/LeadFlow.js";

import LeadTimelineMobile from "../components/LeadTimelineMobile.jsx";
import WhatsAppModalMobile from "../components/WhatsAppModalMobile.jsx";


// ==========================================================
// DETALHES DO LEAD — MOBILE (FASE 4)
// ==========================================================
//
// Tela própria do Mobile — não importa LeadDetailsModal.jsx nem
// nenhum subcomponente do Desktop. Mostra os mesmos campos que
// já existem no documento do lead (nada inventado) e a mesma
// Jornada (JORNADA/nomeDaEtapa de core/LeadFlow.js, não
// alterado) — só como leitura nesta fase, sem clique para trocar
// etapa (isso é uma ação, fica para uma fase futura — ver
// relatório final).
//
// "Observações" do Desktop (LeadNotes.jsx) não é um campo do
// lead — é sempre um evento tipo "OBSERVACAO" na própria
// Timeline. Por isso não existe uma seção separada aqui: ela já
// aparece dentro da Timeline (LeadTimelineMobile.jsx).
// ==========================================================

function formatarData(timestamp) {

  if (!timestamp?.toDate) {

    return "Não disponível";

  }

  return timestamp
    .toDate()
    .toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

}


export default function LeadDetailsScreen({
  lead,
  onVoltar,
}) {

  const [whatsappAberto, setWhatsappAberto] =
    useState(false);


  const etapaAtual =
    Number(
      lead?.etapa ?? 0
    );


  return (

    <div className="mobileLeadDetalhe">

      {/* ====================================================
          CABEÇALHO
      ==================================================== */}

      <header className="mobileLeadDetalheHeader">

        <button
          type="button"
          className="mobileLeadsVoltar"
          onClick={onVoltar}
        >
          ← Voltar
        </button>

        <h1>
          {lead?.nome || "Lead"}
        </h1>

      </header>


      {/* ====================================================
          AÇÃO — WHATSAPP
      ==================================================== */}

      {lead?.telefone && (

        <button
          type="button"
          className="mobileLeadDetalheAcaoWhatsApp"
          onClick={() =>
            setWhatsappAberto(true)
          }
        >
          💬 Enviar WhatsApp
        </button>

      )}


      {/* ====================================================
          INFORMAÇÕES
      ==================================================== */}

      <section className="mobileLeadDetalheSecao">

        <h2>
          ℹ️ Informações
        </h2>

        <div className="mobileLeadDetalheGrade">

          <div className="mobileLeadDetalheCampo">
            <span>📞 Telefone</span>
            <strong>
              {lead?.telefone ||
                "Não informado"}
            </strong>
          </div>

          {lead?.idade && (

            <div className="mobileLeadDetalheCampo">
              <span>🎂 Idade</span>
              <strong>
                {lead.idade} anos
              </strong>
            </div>

          )}

          <div className="mobileLeadDetalheCampo">
            <span>🎯 Objetivo</span>
            <strong>
              {lead?.objetivo ||
                "Não definido"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>📍 Origem</span>
            <strong>
              {lead?.origem ||
                "Não informada"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>👤 Responsável</span>
            <strong>
              {lead?.responsavel ||
                lead?.consultora ||
                "Sem responsável"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>🕒 Criado em</span>
            <strong>
              {formatarData(lead?.createdAt)}
            </strong>
          </div>

        </div>

      </section>


      {/* ====================================================
          JORNADA (SOMENTE LEITURA NESTA FASE)
      ==================================================== */}

      <section className="mobileLeadDetalheSecao">

        <h2>
          📊 Jornada do Cliente
        </h2>

        <div className="mobileJornadaLista">

          {JORNADA.map((etapa) => {

            const concluida =
              etapa.id < etapaAtual;

            const atual =
              etapa.id === etapaAtual;

            return (

              <div
                key={etapa.id}
                className={`
                  mobileJornadaItem
                  ${atual ? "mobileJornadaItemAtual" : ""}
                `}
              >

                <span
                  className={`
                    mobileJornadaCirculo
                    ${
                      concluida || atual
                        ? "mobileJornadaCirculoAtivo"
                        : ""
                    }
                  `}
                >
                  {concluida
                    ? "✓"
                    : etapa.id + 1}
                </span>

                <span className="mobileJornadaNome">
                  {etapa.nome}
                </span>

                {atual && (

                  <span className="mobileJornadaAtualTag">
                    Em andamento
                  </span>

                )}

              </div>

            );

          })}

        </div>

      </section>


      {/* ====================================================
          TIMELINE (inclui observações, quando existirem)
      ==================================================== */}

      <LeadTimelineMobile
        leadId={lead?.id}
      />


      <WhatsAppModalMobile

        aberto={whatsappAberto}

        fechar={() =>
          setWhatsappAberto(false)
        }

        leadId={lead?.id}

        nome={lead?.nome}

        telefone={lead?.telefone}

      />

    </div>

  );

}

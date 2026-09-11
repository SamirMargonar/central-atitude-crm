import { useEffect, useState } from "react";

import "../styles/leadDetails.css";

import {
  JORNADA,
} from "../../core/LeadFlow.js";

import LeadActionsMobile from "../components/LeadActionsMobile.jsx";
import LeadTimelineMobile from "../components/LeadTimelineMobile.jsx";
import WhatsAppModalMobile from "../components/WhatsAppModalMobile.jsx";


// ==========================================================
// DETALHES DO LEAD — MOBILE (FASE 4 + AÇÕES)
// ==========================================================
//
// Tela própria do Mobile — não importa LeadDetailsModal.jsx nem
// nenhum subcomponente do Desktop. Mostra os mesmos campos que
// já existem no documento do lead (nada inventado) e a mesma
// Jornada (JORNADA/nomeDaEtapa de core/LeadFlow.js, não
// alterado) — a Jornada continua só leitura (sem clique para
// trocar etapa manualmente), mas agora a etapa AVANÇA como
// efeito colateral das ações reais (Assumir/Primeiro Contato/
// Resposta, via LeadActionsMobile.jsx), igual ao Desktop.
//
// Estado local do lead (leadLocal/setLeadLocal, sincronizado com
// a prop via useEffect) — mesmo padrão que LeadDetailsModal.jsx
// (Desktop) já usa — permite que as ações atualizem a tela sem
// precisar fechar/reabrir.
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

  const [leadLocal, setLeadLocal] =
    useState(lead);


  useEffect(() => {

    setLeadLocal(lead);

  }, [lead]);


  const [whatsappAberto, setWhatsappAberto] =
    useState(false);


  const etapaAtual =
    Number(
      leadLocal?.etapa ?? 0
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
          {leadLocal?.nome || "Lead"}
        </h1>

      </header>


      {/* ====================================================
          AÇÃO — WHATSAPP
      ==================================================== */}

      {leadLocal?.telefone && (

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
              {leadLocal?.telefone ||
                "Não informado"}
            </strong>
          </div>

          {leadLocal?.idade && (

            <div className="mobileLeadDetalheCampo">
              <span>🎂 Idade</span>
              <strong>
                {leadLocal.idade} anos
              </strong>
            </div>

          )}

          <div className="mobileLeadDetalheCampo">
            <span>🎯 Objetivo</span>
            <strong>
              {leadLocal?.objetivo ||
                "Não definido"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>📍 Origem</span>
            <strong>
              {leadLocal?.origem ||
                "Não informada"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>👤 Responsável</span>
            <strong>
              {leadLocal?.responsavel ||
                leadLocal?.consultora ||
                "Sem responsável"}
            </strong>
          </div>

          <div className="mobileLeadDetalheCampo">
            <span>🕒 Criado em</span>
            <strong>
              {formatarData(leadLocal?.createdAt)}
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
          AÇÕES (Assumir / Primeiro Contato / Resposta)
      ==================================================== */}

      <LeadActionsMobile
        lead={leadLocal}
        setLead={setLeadLocal}
      />


      {/* ====================================================
          TIMELINE (inclui observações, quando existirem)
      ==================================================== */}

      <LeadTimelineMobile
        leadId={leadLocal?.id}
      />


      <WhatsAppModalMobile

        aberto={whatsappAberto}

        fechar={() =>
          setWhatsappAberto(false)
        }

        leadId={leadLocal?.id}

        nome={leadLocal?.nome}

        telefone={leadLocal?.telefone}

      />

    </div>

  );

}

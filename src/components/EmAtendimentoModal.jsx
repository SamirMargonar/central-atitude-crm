import "../styles/emAtendimentoModal.css";

import {
  nomeDaEtapa,
} from "../core/LeadFlow";


// ==========================================================
// LEADS EM ATENDIMENTO — modal
// ==========================================================
//
// Mesmo padrão já usado em RelatorioMatriculas.jsx (overlay +
// modal com altura máxima + lista com scroll próprio) — só com
// classes CSS dedicadas, para não acoplar este fluxo ao
// relatório de matrículas. Não faz nenhuma leitura/escrita
// própria no Firestore: só exibe os `leads` que o Dashboard já
// carregou, e delega a abertura do lead para `onAbrirLead`
// (o mesmo abrirLeadPorId() que já abre o LeadDetailsModal
// existente).
// ==========================================================

export default function EmAtendimentoModal({
  leads = [],
  aberto,
  fechar,
  onAbrirLead,
}) {

  if (!aberto) {
    return null;
  }


  return (

    <div className="emAtendimentoOverlay">

      <div className="emAtendimentoModal">

        {/* ====================================================
            CABEÇALHO
        ==================================================== */}

        <div className="emAtendimentoHeader">

          <div>

            <h2>
              🤝 Leads em Atendimento
            </h2>

            <p>
              {leads.length} lead(s) em atendimento
            </p>

          </div>

          <button
            type="button"
            className="emAtendimentoFechar"
            onClick={fechar}
          >
            ×
          </button>

        </div>


        {/* ====================================================
            LISTA
        ==================================================== */}

        <div className="emAtendimentoLista">

          {leads.length === 0 ? (

            <div className="emAtendimentoVazio">
              Nenhum lead em atendimento no momento.
            </div>

          ) : (

            leads.map((lead) => (

              <button
                type="button"
                className="emAtendimentoItem"
                key={lead.id}
                onClick={() =>
                  onAbrirLead(lead.id)
                }
              >

                <div className="emAtendimentoItemInfo">

                  <strong>
                    {lead.nome || "Lead"}
                  </strong>

                  <span>
                    📞{" "}
                    {lead.telefone ||
                      "Não informado"}
                  </span>

                  <span>
                    👤{" "}
                    {lead.responsavel ||
                      lead.consultora ||
                      "Sem responsável"}
                  </span>

                </div>

                <span className="emAtendimentoItemEtapa">

                  {nomeDaEtapa(
                    Number(
                      lead?.etapa ?? 0
                    )
                  )}

                </span>

              </button>

            ))

          )}

        </div>

      </div>

    </div>

  );

}

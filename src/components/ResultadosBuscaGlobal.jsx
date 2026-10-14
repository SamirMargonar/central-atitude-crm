import { nomeDaEtapa } from "../core/LeadFlow";

import { formatarDataEHoraDaAgenda } from "../utils/formatarData";

import "../styles/buscaGlobal.css";

// ==========================================================
// RESULTADOS DA BUSCA EM LEADS DE OUTRAS RECEPCIONISTAS
// ==========================================================
//
// Lista leve (dados do cache de busca). Abrir um item lê o lead
// completo ao vivo; a titularidade nunca muda por abrir/consultar.
// ==========================================================

export default function ResultadosBuscaGlobal({
  resultados,
  carregando,
  erro,
  termo,
  onAbrir,
  onAtualizar,
}) {

  if (!termo || String(termo).trim().length < 2) {
    return null;
  }

  return (

    <section className="buscaGlobal">

      <div className="buscaGlobalCabecalho">

        <h2>
          🔍 Leads de outras recepcionistas
          {!carregando && ` (${resultados.length})`}
        </h2>

        <button
          type="button"
          className="buscaGlobalAtualizar"
          onClick={onAtualizar}
          disabled={carregando}
        >
          ↻ Atualizar busca
        </button>

      </div>

      {carregando && (
        <p className="buscaGlobalVazio">
          Buscando em todos os leads...
        </p>
      )}

      {erro && !carregando && (
        <p className="buscaGlobalVazio">
          Não foi possível buscar nos leads de outras
          recepcionistas.
        </p>
      )}

      {!carregando && !erro && resultados.length === 0 && (
        <p className="buscaGlobalVazio">
          Nenhum lead de outra recepcionista encontrado.
        </p>
      )}

      {!carregando && resultados.length > 0 && (

        <ul className="buscaGlobalLista">

          {resultados.map((lead) => (

            <li key={lead.id}>

              <button
                type="button"
                className="buscaGlobalItem"
                onClick={() => onAbrir(lead)}
              >

                <strong>{lead.nome || "Sem nome"}</strong>

                <span>📞 {lead.telefone || "Não informado"}</span>

                <span>
                  👤 Titular:{" "}
                  {lead.responsavel ||
                    lead.consultora ||
                    "Sem responsável"}
                </span>

                <span>📍 {nomeDaEtapa(lead.etapa)}</span>

                {lead.visita?.data && (
                  <span>
                    📅 Visita:{" "}
                    {formatarDataEHoraDaAgenda(
                      lead.visita.data,
                      lead.visita.hora,
                      " às "
                    )}
                  </span>
                )}

              </button>

            </li>

          ))}

        </ul>

      )}

    </section>

  );

}

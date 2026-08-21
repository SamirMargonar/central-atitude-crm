import { useMemo, useState } from "react";

import "../styles/relatorioMatriculas.css";

import {
  filtrarMatriculados,
  filtrarRelatorioMatriculas,
  formatarDataMatricula,
  nomePlanoMatricula,
} from "../utils/matriculasFilters";


export default function RelatorioMatriculas({
  leads = [],
  aberto,
  fechar,
}) {

  const [busca, setBusca] =
    useState("");

  const [plano, setPlano] =
    useState("Todos");

  const [consultor, setConsultor] =
    useState("Todos");


  // ==========================================================
  // MATRICULADOS
  // ==========================================================

  const matriculados =
    useMemo(
      () =>
        filtrarMatriculados(leads),
      [leads]
    );


  // ==========================================================
  // OPÇÕES DE PLANO / CONSULTOR
  // ==========================================================

  const planos =
    useMemo(() => {

      const unicos =
        new Set(
          matriculados
            .map(
              (lead) =>
                lead.matricula?.plano
            )
            .filter(Boolean)
        );

      return [
        "Todos",
        ...unicos,
      ];

    }, [matriculados]);

  const consultores =
    useMemo(() => {

      const unicos =
        new Set(
          matriculados
            .map(
              (lead) =>
                lead.matricula?.consultor
            )
            .filter(Boolean)
        );

      return [
        "Todos",
        ...unicos,
      ];

    }, [matriculados]);


  // ==========================================================
  // FILTRADOS
  // ==========================================================

  const filtrados =
    useMemo(
      () =>
        filtrarRelatorioMatriculas(
          matriculados,
          { busca, plano, consultor }
        ),
      [matriculados, busca, plano, consultor]
    );


  if (!aberto) {
    return null;
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="relatorioMatriculasOverlay">

      <div className="relatorioMatriculasModal">

        {/* ====================================================
            CABEÇALHO
        ==================================================== */}

        <div className="relatorioMatriculasHeader">

          <div>

            <h2>
              🎓 Relatório de Matrículas
            </h2>

            <p>
              {matriculados.length} matrícula(s) confirmada(s)
            </p>

          </div>

          <button
            type="button"
            className="relatorioMatriculasFechar"
            onClick={fechar}
          >
            ×
          </button>

        </div>


        {/* ====================================================
            FILTROS
        ==================================================== */}

        <div className="relatorioMatriculasFiltros">

          <input
            type="text"
            placeholder="🔎 Buscar por nome..."
            value={busca}
            onChange={(e) =>
              setBusca(e.target.value)
            }
          />

          <select
            value={plano}
            onChange={(e) =>
              setPlano(e.target.value)
            }
          >

            {planos.map((item) => (

              <option
                key={item}
                value={item}
              >

                {item === "Todos"
                  ? "Todos os planos"
                  : nomePlanoMatricula(item)}

              </option>

            ))}

          </select>

          <select
            value={consultor}
            onChange={(e) =>
              setConsultor(e.target.value)
            }
          >

            {consultores.map((item) => (

              <option
                key={item}
                value={item}
              >

                {item === "Todos"
                  ? "Todos os consultores"
                  : item}

              </option>

            ))}

          </select>

        </div>


        {/* ====================================================
            LISTA
        ==================================================== */}

        <div className="relatorioMatriculasLista">

          {filtrados.length === 0 ? (

            <div className="relatorioMatriculasVazio">
              Nenhuma matrícula encontrada.
            </div>

          ) : (

            filtrados.map((lead) => {

              const matricula =
                lead.matricula || {};

              return (

                <div
                  className="relatorioMatriculasItem"
                  key={lead.id}
                >

                  <div className="relatorioMatriculasNome">

                    <strong>
                      {lead.nome || "Lead"}
                    </strong>

                    <span className="relatorioMatriculasStatus">
                      {matricula.status ||
                        "Não informado"}
                    </span>

                  </div>


                  <div className="relatorioMatriculasCampos">

                    <div>
                      <span>📱 Telefone</span>
                      <strong>
                        {lead.telefone ||
                          "Não informado"}
                      </strong>
                    </div>

                    <div>
                      <span>🎓 Plano</span>
                      <strong>
                        {nomePlanoMatricula(
                          matricula.plano
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>👤 Consultor</span>
                      <strong>
                        {matricula.consultor ||
                          "Não informado"}
                      </strong>
                    </div>

                    <div>
                      <span>📅 Matrícula</span>
                      <strong>
                        {matricula.data ||
                          "Não informada"}
                      </strong>
                    </div>

                    <div>
                      <span>🚀 Início</span>
                      <strong>
                        {formatarDataMatricula(
                          matricula.dataInicio
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>🔄 Vencimento</span>
                      <strong>
                        {formatarDataMatricula(
                          matricula.dataVencimento
                        )}
                      </strong>
                    </div>

                  </div>


                  {matricula.observacao && (

                    <div className="relatorioMatriculasObservacao">
                      📝 {matricula.observacao}
                    </div>

                  )}

                </div>

              );

            })

          )}

        </div>

      </div>

    </div>

  );

}

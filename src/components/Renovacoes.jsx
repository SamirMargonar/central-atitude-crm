import { useMemo } from "react";

import "./Renovacoes.css";

import RenovacaoAcoes from "./RenovacaoAcoes";


export default function Renovacoes({
  leads = [],
  setPagina,
}) {


  // ==========================================================
  // HOJE
  // ==========================================================

  const hoje =
    new Date();


  hoje.setHours(
    0,
    0,
    0,
    0
  );


  // ==========================================================
  // CONVERTE DATA
  // ==========================================================

  function criarData(
    data
  ) {

    if (!data) {
      return null;
    }


    const partes =
      data.split("-");


    if (
      partes.length !== 3
    ) {

      return null;

    }


    const dataConvertida =
      new Date(
        Number(partes[0]),
        Number(partes[1]) - 1,
        Number(partes[2])
      );


    dataConvertida.setHours(
      0,
      0,
      0,
      0
    );


    return dataConvertida;

  }


  // ==========================================================
  // DIFERENÇA EM DIAS
  // ==========================================================

  function calcularDias(
    dataVencimento
  ) {

    const vencimento =
      criarData(
        dataVencimento
      );


    if (!vencimento) {
      return null;
    }


    const diferenca =
      vencimento.getTime() -
      hoje.getTime();


    return Math.ceil(
      diferenca /
      (1000 * 60 * 60 * 24)
    );

  }


  // ==========================================================
  // FORMATA DATA
  // ==========================================================

  function formatarData(
    data
  ) {

    if (!data) {
      return "--/--/----";
    }


    const partes =
      data.split("-");


    if (
      partes.length !== 3
    ) {

      return data;

    }


    return `${partes[2]}/${partes[1]}/${partes[0]}`;

  }


  // ==========================================================
  // NOME DO PLANO
  // ==========================================================

  function nomePlano(
    plano
  ) {

    const nomes = {

      MENSAL:
        "Plano Mensal",

      TRIMESTRAL:
        "Plano Trimestral",

      SEMESTRAL:
        "Plano Semestral",

      ANUAL:
        "Plano Anual",

    };


    return (
      nomes[plano] ||
      plano ||
      "Plano não informado"
    );

  }


  // ==========================================================
  // CLASSIFICAÇÃO
  // ==========================================================

  function classificar(
    dias
  ) {

    if (
      dias === null
    ) {

      return {

        classe:
          "renovacaoSemData",

        titulo:
          "Sem vencimento",

      };

    }


    if (
      dias < 0
    ) {

      return {

        classe:
          "renovacaoVencida",

        titulo:
          "Vencido",

      };

    }


    if (
      dias <= 6
    ) {

      return {

        classe:
          "renovacaoUrgente",

        titulo:
          "Vence nesta semana",

      };

    }


    if (
      dias <= 14
    ) {

      return {

        classe:
          "renovacaoAtencao",

        titulo:
          "Atenção",

      };

    }


    return {

      classe:
        "renovacaoProxima",

      titulo:
        "Próxima renovação",

    };

  }


  // ==========================================================
  // CLIENTES COM MATRÍCULA
  // ==========================================================

  const clientes =
    useMemo(() => {

      return leads

        .filter(
          (lead) =>
            lead?.matricula
              ?.confirmada === true
        )

        .map((lead) => {

          const matricula =
            lead.matricula;


          const dias =
            calcularDias(
              matricula.dataVencimento
            );


          return {

            ...lead,

            dias,

            classificacao:
              classificar(dias),

          };

        })

        .sort((a, b) => {

          if (
            a.dias === null
          ) {

            return 1;

          }


          if (
            b.dias === null
          ) {

            return -1;

          }


          return (
            a.dias -
            b.dias
          );

        });

    }, [leads]);


  // ==========================================================
  // CONTADORES
  // ==========================================================

  const vencidos =
    clientes.filter(
      (cliente) =>
        cliente.dias !== null &&
        cliente.dias < 0
    ).length;


  const urgentes =
    clientes.filter(
      (cliente) =>
        cliente.dias !== null &&
        cliente.dias >= 0 &&
        cliente.dias <= 6
    ).length;


  const atencao =
    clientes.filter(
      (cliente) =>
        cliente.dias !== null &&
        cliente.dias >= 7 &&
        cliente.dias <= 14
    ).length;


  const proximas =
    clientes.filter(
      (cliente) =>
        cliente.dias !== null &&
        cliente.dias >= 15
    ).length;


  // ==========================================================
  // ABRIR AGENDA
  // ==========================================================

  function abrirAgenda() {

    if (setPagina) {

      setPagina(
        "agenda"
      );

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="renovacoesPage">


      {/* ====================================================
          CABEÇALHO
      ==================================================== */}

      <header className="renovacoesHeader">

        <div>

          <h1>
            🔄 Renovações
          </h1>

          <p>
            Acompanhe os alunos próximos do vencimento
            e trabalhe a renovação.
          </p>

        </div>

      </header>


      {/* ====================================================
          RESUMO
      ==================================================== */}

      <section className="renovacoesResumo">


        <div className="renovacaoResumoCard">

          <span>
            ⚫
          </span>

          <div>

            <strong>
              {vencidos}
            </strong>

            <small>
              Vencidos
            </small>

          </div>

        </div>


        <div className="renovacaoResumoCard">

          <span>
            🔴
          </span>

          <div>

            <strong>
              {urgentes}
            </strong>

            <small>
              Até 6 dias
            </small>

          </div>

        </div>


        <div className="renovacaoResumoCard">

          <span>
            🟡
          </span>

          <div>

            <strong>
              {atencao}
            </strong>

            <small>
              7 a 14 dias
            </small>

          </div>

        </div>


        <div className="renovacaoResumoCard">

          <span>
            🟢
          </span>

          <div>

            <strong>
              {proximas}
            </strong>

            <small>
              15+ dias
            </small>

          </div>

        </div>


      </section>


      {/* ====================================================
          LISTA
      ==================================================== */}

      <section className="renovacoesLista">


        {clientes.length === 0 ? (

          <div className="renovacoesVazio">

            <div>
              🎉
            </div>

            <h2>
              Nenhuma renovação cadastrada
            </h2>

            <p>
              Quando uma matrícula for confirmada
              com plano e vencimento, ela aparecerá
              automaticamente aqui.
            </p>

          </div>

        ) : (

          clientes.map(
            (cliente) => (

              <article
                className={`
                  renovacaoCard
                  ${cliente.classificacao.classe}
                `}
                key={cliente.id}
              >


                {/* =========================================
                    TOPO
                ========================================= */}

                <div className="renovacaoCardTopo">

                  <div>

                    <span className="renovacaoStatus">

                      {cliente.classificacao.titulo}

                    </span>

                    <h2>
                      {cliente.nome ||
                        "Cliente"}
                    </h2>

                  </div>


                  <div className="renovacaoDias">

                    {cliente.dias === null ? (

                      <strong>
                        --
                      </strong>

                    ) : cliente.dias < 0 ? (

                      <strong>
                        {Math.abs(
                          cliente.dias
                        )}
                      </strong>

                    ) : (

                      <strong>
                        {cliente.dias}
                      </strong>

                    )}

                    <small>

                      {cliente.dias === null
                        ? "dias"
                        : cliente.dias < 0
                        ? "dias atrasado"
                        : cliente.dias === 0
                        ? "vence hoje"
                        : "dias restantes"}

                    </small>

                  </div>

                </div>


                {/* =========================================
                    INFORMAÇÕES
                ========================================= */}

                <div className="renovacaoInfo">


                  <div>

                    <span>
                      📱 Telefone
                    </span>

                    <strong>
                      {cliente.telefone ||
                        "Não informado"}
                    </strong>

                  </div>


                  <div>

                    <span>
                      🎓 Plano
                    </span>

                    <strong>
                      {nomePlano(
                        cliente.matricula
                          ?.plano
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      📅 Início
                    </span>

                    <strong>
                      {formatarData(
                        cliente.matricula
                          ?.dataInicio
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      🔄 Vencimento
                    </span>

                    <strong>
                      {formatarData(
                        cliente.matricula
                          ?.dataVencimento
                      )}
                    </strong>

                  </div>

                </div>


                {/* =========================================
                    OBJETIVO
                ========================================= */}

                <div className="renovacaoObjetivo">

                  🎯

                  <span>
                    Objetivo:
                  </span>

                  <strong>
                    {cliente.objetivo ||
                      "Não informado"}
                  </strong>

                </div>


                {/* =========================================
                    AÇÕES
                ========================================= */}

                <div className="renovacaoAcoes">

                  <button
                    className="btnRenovacaoAgenda"
                    onClick={
                      abrirAgenda
                    }
                  >
                    📅 Agendar / Ver Agenda
                  </button>


                  <RenovacaoAcoes
                    cliente={cliente}
                  />

                </div>


              </article>

            )
          )

        )}

      </section>

    </div>

  );

}
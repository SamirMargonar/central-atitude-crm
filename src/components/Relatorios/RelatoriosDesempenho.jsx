import {
  formatarPercentual,
} from "../../core/RelatoriosCalculos";


// ==========================================================
// DESEMPENHO POR GRUPO — consultora / origem / objetivo.
// Componente puramente apresentacional. `porConsultora` só é
// exibido quando `mostrarConsultora` é true (recepcionista não
// tem relatorioGeral, então nunca recebe outros uids aqui).
// ==========================================================

function TabelaDesempenho({

  titulo,

  linhas,

  rotuloColuna,

}) {

  if (!linhas || linhas.length === 0) {

    return (

      <div className="blocoDesempenho">

        <h3>
          {titulo}
        </h3>

        <p className="vazioDesempenho">
          Sem dados no período selecionado.
        </p>

      </div>

    );

  }


  return (

    <div className="blocoDesempenho">

      <h3>
        {titulo}
      </h3>

      <table className="tabelaDesempenho">

        <thead>

          <tr>

            <th>
              {rotuloColuna}
            </th>

            <th>
              Leads
            </th>

            <th>
              Visitas
            </th>

            <th>
              Matrículas
            </th>

            <th>
              Lead → Matrícula
            </th>

          </tr>

        </thead>

        <tbody>

          {linhas.map(
            (linha) => (

              <tr key={linha.categoria}>

                <td>
                  {linha.nome || linha.categoria}
                </td>

                <td>
                  {linha.leadsAssumidos}
                </td>

                <td>
                  {linha.visitasRealizadas}
                </td>

                <td>
                  {linha.matriculas}
                </td>

                <td>
                  {formatarPercentual(linha.conversaoLeadMatricula)}
                </td>

              </tr>

            )
          )}

        </tbody>

      </table>

    </div>

  );

}


export default function RelatoriosDesempenho({

  porConsultora = [],

  porOrigem = [],

  porObjetivo = [],

  mostrarConsultora,

}) {

  return (

    <div className="desempenhoRelatorios blocoRelatorios">

      <h2>
        Desempenho por grupo
      </h2>

      {mostrarConsultora && (

        <TabelaDesempenho
          titulo="Por consultora"
          linhas={porConsultora}
          rotuloColuna="Consultora"
        />

      )}

      <TabelaDesempenho
        titulo="Por origem"
        linhas={porOrigem}
        rotuloColuna="Origem"
      />

      <TabelaDesempenho
        titulo="Por objetivo"
        linhas={porObjetivo}
        rotuloColuna="Objetivo"
      />

    </div>

  );

}

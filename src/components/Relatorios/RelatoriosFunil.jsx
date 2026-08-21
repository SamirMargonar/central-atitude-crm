import {
  nomeDaEtapa,
} from "../../core/LeadFlow";


// ==========================================================
// FUNIL COMERCIAL — quantidade de leads atualmente em cada
// etapa (não cumulativo). Componente puramente apresentacional.
// ==========================================================

export default function RelatoriosFunil({

  funil = [],

}) {

  const maiorTotal =
    Math.max(
      1,
      ...funil.map((item) => item.total)
    );


  return (

    <div className="funilRelatorios blocoRelatorios">

      <h2>
        Funil comercial
      </h2>

      <div className="listaFunil">

        {funil.map(
          (item) => (

            <div
              key={item.etapa}
              className="linhaFunil"
            >

              <span className="nomeEtapaFunil">
                {nomeDaEtapa(item.etapa)}
              </span>

              <div className="barraFunil">

                <div
                  className="preenchimentoBarraFunil"
                  style={{
                    width: `${(item.total / maiorTotal) * 100}%`,
                  }}
                />

              </div>

              <span className="totalEtapaFunil">
                {item.total}
              </span>

            </div>

          )
        )}

      </div>

    </div>

  );

}

export default function PrecisaAtencao({

  categorias = [],

  onAbrirLead,

}) {

  const totalGeral =
    categorias.reduce(
      (soma, categoria) =>
        soma + categoria.itens.length,
      0
    );

  return (

    <section className="precisaAtencao">

      <div className="precisaAtencaoCabecalho">

        <h2>
          🎯 Precisa da sua atenção
        </h2>

        <span>
          {totalGeral} pendência(s) no total
        </span>

      </div>


      <div className="precisaAtencaoGrade">

        {categorias.map(
          (categoria) => (

            <div
              className="precisaAtencaoCategoria"
              key={categoria.titulo}
            >

              <div className="precisaAtencaoCategoriaTitulo">

                <span>
                  {categoria.icone} {categoria.titulo}
                </span>

                <strong>
                  {categoria.itens.length}
                </strong>

              </div>


              {categoria.itens.length === 0 ? (

                <p className="precisaAtencaoVazio">
                  Nenhuma pendência.
                </p>

              ) : (

                <ul className="precisaAtencaoLista">

                  {categoria.itens.map(
                    (item) => (

                      <li key={item.id}>

                        <button
                          type="button"
                          onClick={() =>
                            onAbrirLead(item.leadId)
                          }
                        >

                          <strong>
                            {item.nome}
                          </strong>

                          <span>
                            {item.subtitulo}
                          </span>

                        </button>

                      </li>

                    )
                  )}

                </ul>

              )}

            </div>

          )
        )}

      </div>

    </section>

  );

}

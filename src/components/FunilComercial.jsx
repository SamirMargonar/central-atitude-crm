export default function FunilComercial({
  funil = [],
  aberto = true,
  onAlternar,
}) {

  const maior =
    Math.max(
      1,
      ...funil.map(
        (degrau) => degrau.total
      )
    );

  return (

    <section className="dashboardBloco">

      <div className="dashboardBlocoHeader">

        <div>

          <h2>
            📊 Funil Comercial
          </h2>

          <p>
            Quantos leads já atingiram cada etapa da jornada.
          </p>

        </div>

        <button
          type="button"
          className={
            aberto
              ? "botaoAlternarSecao"
              : "botaoAlternarSecao botaoAlternarSecaoFechado"
          }
          onClick={onAlternar}
          aria-label={
            aberto
              ? "Recolher Funil Comercial"
              : "Expandir Funil Comercial"
          }
          title={
            aberto
              ? "Recolher"
              : "Expandir"
          }
        >
          👁️
        </button>

      </div>


      {aberto && (

        <div className="funilComercialLista">

          {funil.map(
            (degrau) => (

              <div
                className="funilComercialDegrau"
                key={degrau.chave}
              >

                <div className="funilComercialLabel">

                  <span>
                    {degrau.label}
                  </span>

                  <strong>
                    {degrau.total}
                  </strong>

                </div>

                <div className="funilComercialBarraFundo">

                  <div
                    className="funilComercialBarra"
                    style={{
                      width:
                        `${(degrau.total / maior) * 100}%`,
                    }}
                  />

                </div>

              </div>

            )
          )}

        </div>

      )}

    </section>

  );

}

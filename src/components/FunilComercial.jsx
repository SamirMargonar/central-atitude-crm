export default function FunilComercial({
  funil = [],
}) {

  const maior =
    Math.max(
      1,
      ...funil.map(
        (degrau) => degrau.total
      )
    );

  return (

    <section className="funilComercial">

      <h2>
        📊 Funil Comercial
      </h2>

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

    </section>

  );

}

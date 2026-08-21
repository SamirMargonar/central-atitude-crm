import {
  formatarPercentual,
} from "../core/RelatoriosCalculos";


const PRESETS = [

  { valor: "HOJE", label: "Hoje" },

  { valor: "7_DIAS", label: "7 dias" },

  { valor: "30_DIAS", label: "30 dias" },

  { valor: "PERSONALIZADO", label: "Personalizado" },

];


export default function IndicadoresPeriodo({

  indicadores,

  periodoSelecionado,

  onMudarPeriodo,

  dataInicioPersonalizada,

  dataFimPersonalizada,

  onMudarDataInicioPersonalizada,

  onMudarDataFimPersonalizada,

  aberto = true,

  onAlternar,

}) {

  const cartoes = [

    {
      chave: "leadsRecebidos",
      label: "Leads recebidos",
      valor: indicadores.leadsRecebidos,
    },

    {
      chave: "visitasAgendadas",
      label: "Visitas",
      valor: indicadores.visitasAgendadas,
    },

    {
      chave: "visitasRealizadas",
      label: "Comparecimentos",
      valor: indicadores.visitasRealizadas,
    },

    {
      chave: "naoComparecimentos",
      label: "Não comparecimentos",
      valor: indicadores.naoComparecimentos,
    },

    {
      chave: "negociacoes",
      label: "Negociações",
      valor: indicadores.negociacoes,
    },

    {
      chave: "matriculas",
      label: "Matrículas",
      valor: indicadores.matriculas,
    },

    {
      chave: "conversaoLeadMatricula",
      label: "Conversão lead → matrícula",
      valor:
        formatarPercentual(
          indicadores.conversaoLeadMatricula
        ),
    },

  ];

  return (

    <section className="dashboardBloco">

      <div className="dashboardBlocoHeader">

        <div>

          <h2>
            📈 Indicadores do Período
          </h2>

          <p>
            Resultados comerciais no intervalo selecionado.
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
              ? "Recolher Indicadores do Período"
              : "Expandir Indicadores do Período"
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

        <>

          <div className="seletorPeriodo">

            {PRESETS.map(
              (preset) => (

                <button
                  type="button"
                  key={preset.valor}
                  className={
                    periodoSelecionado === preset.valor
                      ? "botaoPeriodoAtivo"
                      : "botaoPeriodo"
                  }
                  onClick={() =>
                    onMudarPeriodo(preset.valor)
                  }
                >
                  {preset.label}
                </button>

              )
            )}

          </div>


          {periodoSelecionado === "PERSONALIZADO" && (

            <div className="periodoPersonalizadoCampos">

              <label>
                De
                <input
                  type="date"
                  value={dataInicioPersonalizada}
                  onChange={(e) =>
                    onMudarDataInicioPersonalizada(e.target.value)
                  }
                />
              </label>

              <label>
                Até
                <input
                  type="date"
                  value={dataFimPersonalizada}
                  onChange={(e) =>
                    onMudarDataFimPersonalizada(e.target.value)
                  }
                />
              </label>

            </div>

          )}


          <div className="dashboard indicadoresPeriodoGrade">

            {cartoes.map(
              (cartao) => (

                <div
                  className="cardDashboard"
                  key={cartao.chave}
                >

                  <h3>
                    {cartao.label}
                  </h3>

                  <span className="numero">
                    {cartao.valor}
                  </span>

                </div>

              )
            )}

          </div>

        </>

      )}

    </section>

  );

}

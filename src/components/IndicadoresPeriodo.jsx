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

    <section className="indicadoresPeriodo">

      <div className="indicadoresPeriodoCabecalho">

        <h2>
          📈 Indicadores do Período
        </h2>

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


      <div className="indicadoresPeriodoGrade">

        {cartoes.map(
          (cartao) => (

            <div
              className="indicadorPeriodoCard"
              key={cartao.chave}
            >

              <span>
                {cartao.label}
              </span>

              <strong>
                {cartao.valor}
              </strong>

            </div>

          )
        )}

      </div>

    </section>

  );

}

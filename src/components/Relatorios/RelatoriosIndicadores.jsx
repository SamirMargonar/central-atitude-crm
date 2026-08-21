import {
  formatarPercentual,
} from "../../core/RelatoriosCalculos";


// ==========================================================
// INDICADORES — cartões de números e taxas de conversão.
// Componente puramente apresentacional.
// ==========================================================

export default function RelatoriosIndicadores({

  indicadores,

}) {

  const cartoes =
    [

      {
        titulo: "Leads recebidos",
        valor: indicadores.leadsRecebidos,
        tipo: "neutro",
      },

      {
        titulo: "Leads assumidos",
        valor: indicadores.leadsAssumidos,
        tipo: "neutro",
      },

      {
        titulo: "Em atendimento",
        valor: indicadores.leadsEmAtendimento,
        tipo: "pendente",
      },

      {
        titulo: "Visitas agendadas",
        valor: indicadores.visitasAgendadas,
        tipo: "neutro",
      },

      {
        titulo: "Visitas realizadas",
        valor: indicadores.visitasRealizadas,
        tipo: "positivo",
      },

      {
        titulo: "Não comparecimentos",
        valor: indicadores.naoComparecimentos,
        tipo: "negativo",
      },

      {
        titulo: "Visitas pendentes",
        valor: indicadores.pendentes,
        tipo: "pendente",
      },

      {
        titulo: "Em negociação",
        valor: indicadores.negociacoes,
        tipo: "pendente",
      },

      {
        titulo: "Matrículas",
        valor: indicadores.matriculas,
        tipo: "positivo",
      },

    ];


  const conversoes =
    [

      {
        titulo: "Lead → Visita",
        valor: formatarPercentual(indicadores.conversaoLeadVisita),
      },

      {
        titulo: "Visita → Negociação",
        valor: formatarPercentual(indicadores.conversaoVisitaNegociacao),
      },

      {
        titulo: "Negociação → Matrícula",
        valor: formatarPercentual(indicadores.conversaoNegociacaoMatricula),
      },

      {
        titulo: "Lead → Matrícula",
        valor: formatarPercentual(indicadores.conversaoLeadMatricula),
      },

    ];


  return (

    <div className="indicadoresRelatorios">

      <div className="gradeIndicadores">

        {cartoes.map(
          (cartao) => (

            <div
              key={cartao.titulo}
              className={`cartaoIndicador indicador${cartao.tipo.charAt(0).toUpperCase()}${cartao.tipo.slice(1)}`}
            >

              <span className="valorIndicador">
                {cartao.valor}
              </span>

              <span className="tituloIndicador">
                {cartao.titulo}
              </span>

            </div>

          )
        )}

      </div>


      <div className="gradeConversoes">

        {conversoes.map(
          (conversao) => (

            <div
              key={conversao.titulo}
              className="cartaoConversao"
            >

              <span className="valorConversao">
                {conversao.valor}
              </span>

              <span className="tituloConversao">
                {conversao.titulo}
              </span>

            </div>

          )
        )}

      </div>

    </div>

  );

}

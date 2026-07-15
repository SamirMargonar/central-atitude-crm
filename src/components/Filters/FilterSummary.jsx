export default function FilterSummary({
  total,
  encontrados,
  onLimpar,
}) {

  return (

    <div className="filterSummary">

      <div className="filterInfo">

        <strong>
          Mostrando {encontrados} de {total} leads
        </strong>

      </div>

      <button
        className="btnLimparFiltros"
        onClick={onLimpar}
      >
        🧹 Limpar filtros
      </button>

    </div>

  );

}
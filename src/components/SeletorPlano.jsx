import "../styles/seletorPlano.css";

import {
  agruparPorCategoria,
  centavosParaReais,
  duracaoEmMeses,
} from "../utils/planos";

// ==========================================================
// SELETOR DE PLANO (matrícula, edição e renovação)
// ==========================================================
//
// Lista os planos vindos de usePlanos() agrupados por categoria e
// mostra, abaixo, as condições do plano escolhido (valor, taxa de
// adesão, duração e condições comerciais) quando existirem. Sem
// valores cadastrados, mostra só a duração — como era antes.
// ==========================================================

export default function SeletorPlano({
  value,
  onChange,
  lista,
  categorias,
  fallback = false,
  carregando = false,
}) {

  const grupos = agruparPorCategoria(lista, categorias);

  const escolhido = lista.find((p) => p.id === value) || null;

  const meses = duracaoEmMeses(escolhido);

  return (

    <>

      <select
        value={escolhido ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={carregando && lista.length === 0}
      >

        {!escolhido && (
          <option value="" disabled>
            {carregando ? "Carregando planos..." : "Selecione o plano"}
          </option>
        )}

        {grupos.map((grupo) => (

          <optgroup key={grupo.categoria.id} label={grupo.categoria.nome}>

            {grupo.planos.map((plano) => (

              <option key={plano.id} value={plano.id}>
                {plano.nome}
                {plano.mantido ? " (desativado — plano atual)" : ""}
              </option>

            ))}

          </optgroup>

        ))}

      </select>

      {fallback && (
        <small style={{ display: "block", color: "#7a5600", marginTop: "4px" }}>
          Catálogo de planos ainda não cadastrado: exibindo os planos
          padrão.
        </small>
      )}

      {escolhido && (

        <div className="seletorPlanoInfo">

          {meses && (
            <span>
              ⏱ {meses} {meses === 1 ? "mês" : "meses"}
            </span>
          )}

          {Number.isInteger(escolhido.valorCentavos) && (
            <span>💰 {centavosParaReais(escolhido.valorCentavos)}</span>
          )}

          {Number.isInteger(escolhido.taxaAdesaoCentavos) && (
            <span>
              🧾 Adesão: {centavosParaReais(escolhido.taxaAdesaoCentavos)}
            </span>
          )}

          {escolhido.condicoes && (
            <span style={{ flexBasis: "100%" }}>📝 {escolhido.condicoes}</span>
          )}

        </div>

      )}

    </>

  );

}

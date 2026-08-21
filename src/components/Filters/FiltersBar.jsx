import "./Filters.css";

import SearchInput from "./SearchInput";
import FilterSelect from "./FilterSelect";


export default function FiltersBar({

  filtros,

  setFiltros,

  consultoras,

  origens,

  objetivos,

  status,

  meses,

}) {


  function atualizarFiltro(
    campo,
    valor
  ) {

    setFiltros({

      ...filtros,

      [campo]: valor,

    });

  }


  function limparFiltros() {

    const agora =
      new Date();


    const ano =
      agora.getFullYear();


    const mes =
      String(
        agora.getMonth() + 1
      ).padStart(2, "0");


    setFiltros({

      pesquisa: "",

      consultora: "Todas",

      origem: "Todas",

      status: "Todos",

      objetivo: "Todos",

      mes:
        `${ano}-${mes}`,

    });

  }


 const filtrosAtivos =

  filtros.pesquisa !== "" ||

  filtros.consultora !== "Todas" ||

  filtros.origem !== "Todas" ||

  filtros.objetivo !== "Todos" ||

  filtros.status !== "Todos" ||

  filtros.mes !== "";

  return (

    <section className="filtersBar">


      {/* ==========================================
          PESQUISA
      ========================================== */}

      <SearchInput

        value={
          filtros.pesquisa
        }

        onChange={(valor) =>
          atualizarFiltro(
            "pesquisa",
            valor
          )
        }

      />


      {/* ==========================================
          MÊS
      ========================================== */}

      <FilterSelect

        placeholder="Mês"

        value={
          filtros.mes
        }

        options={
          meses
        }

        onChange={(valor) =>
          atualizarFiltro(
            "mes",
            valor
          )
        }

      />


      {/* ==========================================
          CONSULTORA
      ========================================== */}

      <FilterSelect

        placeholder="Todas as Consultoras"

        value={
          filtros.consultora
        }

        options={
          consultoras
        }

        onChange={(valor) =>
          atualizarFiltro(
            "consultora",
            valor
          )
        }

      />


      {/* ==========================================
          ORIGEM
      ========================================== */}

      <FilterSelect

        placeholder="Todas as Origens"

        value={
          filtros.origem
        }

        options={
          origens
        }

        onChange={(valor) =>
          atualizarFiltro(
            "origem",
            valor
          )
        }

      />


      {/* ==========================================
          OBJETIVO
      ========================================== */}

      <FilterSelect

        placeholder="Todos os Objetivos"

        value={
          filtros.objetivo
        }

        options={
          objetivos
        }

        onChange={(valor) =>
          atualizarFiltro(
            "objetivo",
            valor
          )
        }

      />


      {/* ==========================================
          STATUS
      ========================================== */}

      <FilterSelect

        placeholder="Todos os Status"

        value={
          filtros.status
        }

        options={
          status
        }

        onChange={(valor) =>
          atualizarFiltro(
            "status",
            valor
          )
        }

      />


      {/* ==========================================
          LIMPAR
      ========================================== */}

      {filtrosAtivos && (

        <button

          type="button"

          className="btnLimparFiltros"

          onClick={
            limparFiltros
          }

        >

          ✕ Limpar filtros

        </button>

      )}

    </section>

  );

}
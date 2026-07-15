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
}) {

  return (

    <section className="filtersBar">

      <SearchInput
        value={filtros.pesquisa}
        onChange={(valor) =>
          setFiltros({
            ...filtros,
            pesquisa: valor,
          })
        }
      />

      <FilterSelect
        placeholder="Todas as Consultoras"
        value={filtros.consultora}
        options={consultoras}
        onChange={(valor) =>
          setFiltros({
            ...filtros,
            consultora: valor,
          })
        }
      />

      <FilterSelect
        placeholder="Todas as Origens"
        value={filtros.origem}
        options={origens}
        onChange={(valor) =>
          setFiltros({
            ...filtros,
            origem: valor,
          })
        }
      />

      <FilterSelect
        placeholder="Todos os Objetivos"
        value={filtros.objetivo}
        options={objetivos}
        onChange={(valor) =>
          setFiltros({
            ...filtros,
            objetivo: valor,
          })
        }
      />

      <FilterSelect
        placeholder="Todos os Status"
        value={filtros.status}
        options={status}
        onChange={(valor) =>
          setFiltros({
            ...filtros,
            status: valor,
          })
        }
      />

    </section>

  );

}
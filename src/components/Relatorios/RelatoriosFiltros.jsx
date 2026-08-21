import {
  JORNADA,
} from "../../core/LeadFlow";


// ==========================================================
// FILTROS DOS RELATÓRIOS
//
// Componente controlado — não faz nenhuma consulta ao
// Firestore. Todos os filtros combinam com E lógico e são
// aplicados no cliente, sobre os dados já carregados.
// ==========================================================

export default function RelatoriosFiltros({

  filtros,

  onChange,

  mostrarConsultora,

  usuariosPorUid = {},

  categoriasOrigem = [],

  categoriasObjetivo = [],

}) {

  function atualizar(campo, valor) {

    onChange({

      ...filtros,

      [campo]:
        valor,

    });

  }


  const listaUsuarios =
    Object.values(usuariosPorUid);


  return (

    <div className="filtrosRelatorios">

      <div className="campoFiltro">

        <label>
          De
        </label>

        <input
          type="date"
          value={filtros.dataInicio}
          onChange={(e) =>
            atualizar("dataInicio", e.target.value)
          }
        />

      </div>


      <div className="campoFiltro">

        <label>
          Até
        </label>

        <input
          type="date"
          value={filtros.dataFim}
          onChange={(e) =>
            atualizar("dataFim", e.target.value)
          }
        />

      </div>


      {mostrarConsultora && (

        <div className="campoFiltro">

          <label>
            Consultora
          </label>

          <select
            value={filtros.consultoraUid}
            onChange={(e) =>
              atualizar("consultoraUid", e.target.value)
            }
          >

            <option value="">
              Todas
            </option>

            {listaUsuarios.map(
              (usuario) => (

                <option
                  key={usuario.id}
                  value={usuario.id}
                >
                  {usuario.nome}
                </option>

              )
            )}

          </select>

        </div>

      )}


      <div className="campoFiltro">

        <label>
          Origem
        </label>

        <select
          value={filtros.origem}
          onChange={(e) =>
            atualizar("origem", e.target.value)
          }
        >

          <option value="">
            Todas
          </option>

          {categoriasOrigem.map(
            (categoria) => (

              <option
                key={categoria}
                value={categoria}
              >
                {categoria}
              </option>

            )
          )}

        </select>

      </div>


      <div className="campoFiltro">

        <label>
          Objetivo
        </label>

        <select
          value={filtros.objetivo}
          onChange={(e) =>
            atualizar("objetivo", e.target.value)
          }
        >

          <option value="">
            Todos
          </option>

          {categoriasObjetivo.map(
            (categoria) => (

              <option
                key={categoria}
                value={categoria}
              >
                {categoria}
              </option>

            )
          )}

        </select>

      </div>


      <div className="campoFiltro">

        <label>
          Etapa
        </label>

        <select
          value={filtros.etapa}
          onChange={(e) =>
            atualizar("etapa", e.target.value)
          }
        >

          <option value="">
            Todas
          </option>

          {JORNADA.map(
            (item) => (

              <option
                key={item.id}
                value={item.id}
              >
                {item.nome}
              </option>

            )
          )}

        </select>

      </div>

    </div>

  );

}

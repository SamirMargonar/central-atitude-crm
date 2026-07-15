import { useState } from "react";

export default function PrimeiroContatoForm({

  onCancelar,

  onSalvar,

}) {

  const [tipoContato, setTipoContato] = useState("WhatsApp");

  const [resultado, setResultado] = useState("");

  return (

    <>

      <h2>📞 Registrar Primeiro Contato</h2>

      <div className="formGroup">

        <label>Tipo de contato</label>

        <select
          value={tipoContato}
          onChange={(e) =>
            setTipoContato(e.target.value)
          }
        >

          <option>WhatsApp</option>

          <option>Ligação</option>

          <option>Presencial</option>

        </select>

      </div>

      <div className="formGroup">

        <label>Resultado</label>

        <textarea

          placeholder="Descreva como foi o primeiro contato..."

          value={resultado}

          onChange={(e) =>
            setResultado(e.target.value)
          }

        />

      </div>

      <div className="leadActionButtons">

        <button
          className="btnCancelar"
          onClick={onCancelar}
        >
          Cancelar
        </button>

        <button
          className="btnSalvar"
          onClick={() =>
            onSalvar({

              tipoContato,

              resultado,

            })
          }
        >
          Salvar
        </button>

      </div>

    </>

  );

}
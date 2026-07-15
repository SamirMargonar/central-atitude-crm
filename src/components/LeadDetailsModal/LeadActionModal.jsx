import { useState } from "react";

export default function LeadActionModal({

  aberto,

  titulo,

  placeholder,

  onCancelar,

  onConfirmar,

}) {

  const [observacao, setObservacao] = useState("");

  if (!aberto) return null;

  return (

    <div className="modalOverlay">

      <div className="leadActionModal">

        <h2>{titulo}</h2>

        <textarea

          placeholder={placeholder}

          value={observacao}

          onChange={(e) =>
            setObservacao(e.target.value)
          }

        />

        <div className="leadActionButtons">

          <button
            className="btnCancelar"
            onClick={onCancelar}
          >
            Cancelar
          </button>

          <button
            className="btnSalvar"
            onClick={() => {

              onConfirmar(observacao);

              setObservacao("");

            }}
          >
            Confirmar
          </button>

        </div>

      </div>

    </div>

  );

}
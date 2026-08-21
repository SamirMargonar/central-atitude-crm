import { useState } from "react";

export default function PrimeiroContatoForm({

  lead,

  onEnviar,

  onCancelar,

}) {

  const [mensagem, setMensagem] = useState(

`Olá ${lead?.nome || ""}! 😊

Meu nome é Samir e faço parte da equipe da Academia Viva Attitude.

Recebemos seu interesse e gostaríamos de entender melhor seu objetivo para podermos te ajudar da melhor forma.

Quando você teria alguns minutos para conversarmos? 💪`

  );

  return (

    <>

      <label>

        Mensagem

      </label>

      <textarea

        rows={10}

        className="leadNotesInput"

        value={mensagem}

        onChange={(e)=>setMensagem(e.target.value)}

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

          onClick={()=>onEnviar(mensagem)}

        >

          📲 Enviar pelo WhatsApp

        </button>

      </div>

    </>

  );

}
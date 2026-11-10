import { useState } from "react";

import {
  excluirLead,
} from "../../../core/EventEngine";

import {
  useAuth,
} from "../../../auth/AuthContext";

import * as firestore from "firebase/firestore";

import {
  db,
} from "../../../firebase/firebase";

import {
  criarServicoTelefones,
} from "../../../services/telefonesLeads";


// Ao excluir o lead, o telefone dele volta a ficar livre (índice único
// do telefone removido). É melhor-esforço: se falhar, o índice vira
// "órfão" e o próximo cadastro desse número o assume sozinho.
const servicoTelefones =
  criarServicoTelefones({
    db,
    fs: firestore,
  });


export default function ExcluirLeadAction({
  lead,
  onExcluido,
}) {

  const {
    permissoes,
  } = useAuth();


  const [excluindo, setExcluindo] =
    useState(false);


  // ==========================================================
  // EXCLUIR
  //
  // Confirmação explícita antes de qualquer chamada ao
  // Firestore. Nunca exclui silenciosamente — sucesso e falha
  // (inclusive "possui visita vinculada") sempre viram um
  // alert() explicando o que aconteceu.
  // ==========================================================

  async function excluir() {

    const confirmado = window.confirm(
      "Tem certeza que deseja excluir este lead? Esta ação não poderá ser desfeita."
    );

    if (!confirmado) {
      return;
    }


    try {

      setExcluindo(true);

      await excluirLead(lead.id);

      await servicoTelefones.liberarTelefone(
        lead.id,
        lead.telefone
      );

      alert(
        "Lead excluído com sucesso."
      );

      if (onExcluido) {
        onExcluido();
      }

    } catch (erro) {

      console.error(
        "Erro ao excluir Lead:",
        erro
      );

      if (erro?.codigo === "LEAD_COM_VISITA_VINCULADA") {

        alert(
          "❌ Este Lead possui visita vinculada e não pode ser excluído. Reagende ou remova o vínculo da visita antes de tentar novamente."
        );

      } else {

        alert(
          "Não foi possível excluir o Lead."
        );

      }

    } finally {

      setExcluindo(false);

    }

  }


  if (!permissoes.excluirLead) {
    return null;
  }


  return (

    <div className="leadDangerZone">

      <button
        type="button"
        className="btnExcluirLead"
        onClick={excluir}
        disabled={excluindo}
      >
        {excluindo
          ? "Excluindo..."
          : "🗑️ Excluir Lead"}
      </button>

    </div>

  );

}

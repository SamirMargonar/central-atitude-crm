import { useEffect, useState } from "react";

import "./LeadDetailsModal.css";

import LeadHeader from "./LeadHeader";
import LeadOwner from "./LeadOwner";
import LeadJourney from "./LeadJourney";
import LeadActions from "./LeadActions";
import LeadNotes from "./LeadNotes";
import LeadTimeline from "./LeadTimeline";
import LeadTransfer from "./LeadTransfer";
import ExcluirLeadAction from "./actions/ExcluirLeadAction";

import { useAuth } from "../../auth/AuthContext";

export default function LeadDetailsModal({
  lead,
  onClose,
}) {

  const {
    perfilUsuario,
    isAdmin,
    isCoordenador,
    permissoes,
  } = useAuth();


  const [leadLocal, setLeadLocal] =
    useState(lead);


  useEffect(() => {

    setLeadLocal(lead);

  }, [lead]);


  if (!leadLocal) {
    return null;
  }


  // ==========================================================
  // MODO CONSULTA
  //
  // Mesmo critério de "souDonoDoLead" já usado em
  // firestore.rules (responsavelUid / consultora / responsavel),
  // aplicado no cliente só para decidir o que MOSTRAR — as
  // Rules continuam sendo a autoridade final de segurança,
  // isto aqui só evita exibir um botão que hoje já falharia ao
  // ser clicado por quem não é dono do lead.
  // ==========================================================

  const souDonoDoLead =
    !!perfilUsuario &&
    (
      leadLocal?.responsavelUid === perfilUsuario?.id ||
      leadLocal?.consultora === perfilUsuario?.nome ||
      leadLocal?.responsavel === perfilUsuario?.nome
    );

  const podeAgir =
    isAdmin ||
    isCoordenador ||
    souDonoDoLead;


  return (

    <div className="modalOverlay">

      <div className="leadModal">

        {!podeAgir && (

          <div className="leadModoConsulta">
            🔍 Modo consulta — você está vendo este lead, mas
            ele é de outro responsável. Ações de edição estão
            desabilitadas.
          </div>

        )}

        <LeadHeader
          lead={leadLocal}
          setLead={setLeadLocal}
          onClose={onClose}
          podeAgir={podeAgir}
        />

        <LeadOwner
          lead={leadLocal}
          setLead={setLeadLocal}
          podeAgir={podeAgir}
        />

        <LeadJourney
          lead={leadLocal}
          setLead={setLeadLocal}
          podeAgir={podeAgir}
        />

        <LeadActions
          lead={leadLocal}
          setLead={setLeadLocal}
          podeAgir={podeAgir}
        />

        <LeadNotes
          lead={leadLocal}
          setLead={setLeadLocal}
          podeAgir={podeAgir}
        />

        <LeadTimeline
          lead={leadLocal}
        />

        {permissoes.transferirLead && podeAgir && (

          <LeadTransfer
            lead={leadLocal}
          />

        )}

        {podeAgir && (

          <ExcluirLeadAction
            lead={leadLocal}
            onExcluido={onClose}
          />

        )}

      </div>

    </div>

  );

}
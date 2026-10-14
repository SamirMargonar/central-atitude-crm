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
import ReativarLeadAction from "./actions/ReativarLeadAction";

import { useAuth } from "../../auth/AuthContext";

import { podeTransferirEmMassa } from "../../config/transferenciaEmMassa";

export default function LeadDetailsModal({
  lead,
  onClose,
}) {

  const {
    usuario,
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


  // ATENDIMENTO COMPARTILHADO — recepcionista com conta ativa atendendo
  // o lead de OUTRA consultora. A propriedade não muda: só as operações
  // autorizadas nas Rules (observação, reagendar, comparecimento,
  // fechamento/não fechamento) ficam disponíveis. As Rules são a
  // autoridade; isto só decide o que mostrar.
  const modoCompartilhado =
    !podeAgir &&
    perfilUsuario?.perfil === "recepcionista" &&
    perfilUsuario?.ativo !== false;


  // Trocar o responsável (transferência individual ou em massa) e
  // EXCLUIR lead são restritos a duas identidades fixas — aplicado
  // pelas Rules (excluir era o contorno "apagar e recriar"); aqui só
  // evitamos mostrar um botão que seria negado.
  const podeTrocarResponsavel =
    permissoes.transferirLead &&
    podeTransferirEmMassa(
      usuario?.uid,
      perfilUsuario?.perfil
    );


  return (

    <div className="modalOverlay">

      <div className="leadModal">

        {!podeAgir && !modoCompartilhado && (

          <div className="leadModoConsulta">
            🔍 Modo consulta — você está vendo este lead, mas
            ele é de outro responsável. Ações de edição estão
            desabilitadas.
          </div>

        )}

        {modoCompartilhado && (

          <div className="leadModoConsulta">
            🤝 Atendimento compartilhado — este lead pertence a{" "}
            {leadLocal?.responsavel || leadLocal?.consultora || "outra consultora"}.
            Você pode registrar observações, reagendar a visita,
            registrar comparecimento e fechamento; a propriedade
            do lead não muda e cada ação fica registrada com o seu
            nome.
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
          modoCompartilhado={modoCompartilhado}
        />

        {podeAgir && (

          <ReativarLeadAction
            lead={leadLocal}
            setLead={setLeadLocal}
          />

        )}

        <LeadNotes
          lead={leadLocal}
          setLead={setLeadLocal}
          podeAgir={podeAgir || modoCompartilhado}
        />

        <LeadTimeline
          lead={leadLocal}
        />

        {podeTrocarResponsavel && podeAgir && (

          <LeadTransfer
            lead={leadLocal}
          />

        )}

        {podeAgir && podeTrocarResponsavel && (

          <ExcluirLeadAction
            lead={leadLocal}
            onExcluido={onClose}
          />

        )}

      </div>

    </div>

  );

}
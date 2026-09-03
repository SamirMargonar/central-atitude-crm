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

  const { permissoes } =
    useAuth();


  const [leadLocal, setLeadLocal] =
    useState(lead);


  useEffect(() => {

    setLeadLocal(lead);

  }, [lead]);


  if (!leadLocal) {
    return null;
  }


  return (

    <div className="modalOverlay">

      <div className="leadModal">

        <LeadHeader
          lead={leadLocal}
          setLead={setLeadLocal}
          onClose={onClose}
        />

        <LeadOwner
          lead={leadLocal}
          setLead={setLeadLocal}
        />

        <LeadJourney
          lead={leadLocal}
        />

        <LeadActions
          lead={leadLocal}
          setLead={setLeadLocal}
        />

        <LeadNotes
          lead={leadLocal}
          setLead={setLeadLocal}
        />

        <LeadTimeline
          lead={leadLocal}
        />

        {permissoes.transferirLead && (

          <LeadTransfer
            lead={leadLocal}
          />

        )}

        <ExcluirLeadAction
          lead={leadLocal}
          onExcluido={onClose}
        />

      </div>

    </div>

  );

}
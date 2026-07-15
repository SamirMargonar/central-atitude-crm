import "./LeadDetailsModal.css";

import LeadHeader from "./LeadHeader";
import LeadOwner from "./LeadOwner";
import LeadJourney from "./LeadJourney";
import LeadActions from "./LeadActions";
import LeadNotes from "./LeadNotes";
import LeadTimeline from "./LeadTimeline";
import LeadTransfer from "./LeadTransfer";

export default function LeadDetailsModal({
  lead,
  onClose,
  setLead,
}) {

  if (!lead) return null;

  return (

    <div className="modalOverlay">

      <div className="leadModal">

        {/* HEADER */}

        <LeadHeader
          lead={lead}
          onClose={onClose}
        />

        {/* RESPONSÁVEL */}

        <LeadOwner
          lead={lead}
        />

        {/* JORNADA */}

        <LeadJourney
          lead={lead}
        />

        {/* PRÓXIMA AÇÃO */}

        <LeadActions
          lead={lead}
        />

        {/* OBSERVAÇÕES */}

        <LeadNotes
          lead={lead}
          setLead={setLead}
        />

        {/* TIMELINE */}

        <LeadTimeline
          lead={lead}
        />

        {/* TRANSFERÊNCIA */}

        <LeadTransfer
          lead={lead}
        />

      </div>

    </div>

  );

}
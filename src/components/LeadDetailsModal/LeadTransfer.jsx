import { useState } from "react";

import {
  atualizarLead,
  registrarEvento,
} from "../../core/EventEngine";

import "./LeadDetailsModal.css";

export default function LeadTransfer({ lead }) {

  const [responsavel, setResponsavel] = useState("");
  const [motivo, setMotivo] = useState("");

  async function transferirLead() {

    if (!responsavel) {

      alert("Selecione o novo responsável.");

      return;

    }

    if (!motivo.trim()) {

      alert("Informe o motivo da transferência.");

      return;

    }

    await atualizarLead(lead.id, {

      responsavel,

    });

    await registrarEvento({

      leadId: lead.id,

      tipo: "TRANSFERENCIA",

      usuario: "Samir",

      descricao: `Lead transferido de ${lead.responsavel || "Sem responsável"} para ${responsavel}. Motivo: ${motivo}`,

    });

    setResponsavel("");
    setMotivo("");

  }

  return (

    <section className="leadTransfer">

      <h3>🔄 Transferir Lead</h3>

      <select
        value={responsavel}
        onChange={(e) =>
          setResponsavel(e.target.value)
        }
      >

        <option value="">
          Selecione...
        </option>

        <option>Isabele</option>

        <option>Ana</option>

        <option>Malu</option>

      </select>

      <textarea
        placeholder="Motivo da transferência..."
        value={motivo}
        onChange={(e) =>
          setMotivo(e.target.value)
        }
      />

      <button
        className="btnTransferir"
        onClick={transferirLead}
      >
        Transferir
      </button>

    </section>

  );

}
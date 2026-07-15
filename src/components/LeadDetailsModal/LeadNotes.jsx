import { useState } from "react";
import { registrarEvento } from "../../core/EventEngine";

import "./LeadDetailsModal.css";

export default function LeadNotes({ lead }) {

  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarObservacao() {

    if (!texto.trim()) return;

    setSalvando(true);

    try {

      await registrarEvento({
        leadId: lead.id,
        tipo: "OBSERVACAO",
        usuario: "Samir",
        descricao: texto,
      });

      setTexto("");

    } catch (erro) {

      console.error(erro);

      alert("Erro ao salvar observação.");

    }

    setSalvando(false);

  }

  return (

    <section className="leadNotes">

      <h3>📝 Observações</h3>

      <textarea
        className="leadNotesInput"
        placeholder="Digite uma observação..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <button
        className="btnSalvarObservacao"
        onClick={salvarObservacao}
        disabled={salvando}
      >
        {salvando ? "Salvando..." : "Salvar Observação"}
      </button>

    </section>

  );

}
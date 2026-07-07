import { useState } from "react";

import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "../styles/leadModal.css";

export default function LeadModal({ aberto, fechar }) {

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [idade, setIdade] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [origem, setOrigem] = useState("");

  if (!aberto) return null;

  async function salvarLead() {

    if (
      !nome ||
      !telefone ||
      !idade ||
      !objetivo ||
      !origem
    ) {
      alert("Preencha todos os campos.");
      return;
    }

    await addDoc(collection(db, "leads"), {

      nome,

      telefone,

      idade,

      objetivo,

      origem,

      status: "Novo Lead",

      createdAt: serverTimestamp()

    });

    setNome("");
    setTelefone("");
    setIdade("");
    setObjetivo("");
    setOrigem("");

    fechar();

  }

  return (
    <div className="modalOverlay">

      <div className="modal">

        <h2>Novo Lead</h2>

        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <input
          placeholder="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />

        <input
          placeholder="Idade"
          value={idade}
          onChange={(e) => setIdade(e.target.value)}
        />

        <input
          placeholder="Objetivo"
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
        />

        <input
          placeholder="Origem"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        />

        <div className="modalBotoes">

          <button
            className="btnCancelar"
            onClick={fechar}
          >
            Cancelar
          </button>

          <button
            className="btnSalvar"
            onClick={salvarLead}
          >
            Salvar Lead
          </button>

        </div>

      </div>

    </div>
  );
}
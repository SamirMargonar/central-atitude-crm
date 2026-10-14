import { useEffect, useState } from "react";

import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../firebase/firebase";

import { cacheBuscaLeadsSessao } from "../services/buscaLeadsSessao";

// ==========================================================
// UM LEAD AO VIVO (por id)
// ==========================================================
//
// Usado para abrir, a partir da busca global, um lead que NÃO
// está na lista local da recepcionista (lead de outra titular).
// Lê só esse documento (a Rule de leitura de lead já permite) e
// mantém o modal atualizado, como acontece com os leads locais.
// Também mantém o cache de busca coerente. Nenhuma escrita.
// ==========================================================

export default function useLeadAoVivo(id) {

  const [lead, setLead] = useState(null);

  useEffect(() => {

    if (!id) {
      setLead(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "leads", id),
      (snap) => {

        if (!snap.exists()) {
          setLead(null);
          cacheBuscaLeadsSessao.aplicarLead(id, null);
          return;
        }

        const dados = snap.data();

        setLead({ id: snap.id, ...dados });

        cacheBuscaLeadsSessao.aplicarLead(snap.id, dados);

      },
      (erro) => {
        console.error("Erro ao abrir o lead:", erro);
        setLead(null);
      }
    );

    return () => unsubscribe();

  }, [id]);

  return lead;

}

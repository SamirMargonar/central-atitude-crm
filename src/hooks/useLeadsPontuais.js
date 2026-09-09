import {
  useEffect,
  useState,
} from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";


// ==========================================================
// BUSCA PONTUAL DE LEADS POR ID
// ==========================================================
//
// Complementa (nunca substitui) o array `leads` já carregado
// por useLeads() — usado só quando um leadId não está nesse
// array local. Isso acontece quando uma VISITA está visível
// (por turno, ex.: src/Agenda/Calendario.jsx) mas o LEAD dela
// não está entre os leads que useLeads() carrega para quem
// está vendo (useLeads() só traz os leads da própria
// recepcionista + fila "Recebidos" — não alterado por este
// hook).
//
// Sempre getDoc(doc(db,"leads",id)) — leitura pontual por id,
// nunca getDocs(collection("leads")). Já permitida a qualquer
// recepcionista desde o commit ce0546d (firestore.rules,
// possoVerLead() — não alterado aqui).
//
// Cache em memória do módulo, compartilhado entre todos os
// componentes que usarem este hook na mesma sessão do
// navegador — evita reler o mesmo lead mais de uma vez (ex.:
// Calendario.jsx e Leads.jsx pedindo o mesmo leadId).
// ==========================================================

const cacheDeLeads = new Map();


export default function useLeadsPontuais(
  leadIds = []
) {

  const [leadsPorId, setLeadsPorId] =
    useState({});


  const idsUnicos =
    [...new Set(
      leadIds.filter(Boolean)
    )];


  // Chave estável para o useEffect — o array `leadIds` que os
  // chamadores passam costuma ser recriado a cada render
  // (.filter()/.map() inline), então usamos uma string
  // derivada como dependência, não o array em si.
  const chave =
    idsUnicos
      .slice()
      .sort()
      .join("|");


  useEffect(() => {

    const idsFaltantes =
      idsUnicos.filter(
        (id) =>
          !cacheDeLeads.has(id)
      );


    function montarResultado() {

      const resultado = {};

      idsUnicos.forEach((id) => {

        resultado[id] =
          cacheDeLeads.get(id) ||
          null;

      });

      return resultado;

    }


    if (idsFaltantes.length === 0) {

      // Nada novo para buscar — só sincroniza o estado local
      // a partir do cache já existente, sem nenhuma leitura no
      // Firestore.
      setLeadsPorId(
        montarResultado()
      );

      return;

    }


    let ativo = true;


    async function buscarFaltantes() {

      await Promise.all(

        idsFaltantes.map(
          async (id) => {

            try {

              const snapshot =
                await getDoc(
                  doc(db, "leads", id)
                );

              cacheDeLeads.set(
                id,
                snapshot.exists()
                  ? {
                      id: snapshot.id,
                      ...snapshot.data(),
                    }
                  : null
              );

            } catch (erro) {

              console.error(
                "Erro ao buscar lead pontual:",
                id,
                erro
              );

              cacheDeLeads.set(
                id,
                null
              );

            }

          }
        )

      );


      if (!ativo) {
        return;
      }

      setLeadsPorId(
        montarResultado()
      );

    }


    buscarFaltantes();


    return () => {

      ativo = false;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);


  return leadsPorId;

}

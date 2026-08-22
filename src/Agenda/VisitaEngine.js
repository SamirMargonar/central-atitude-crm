import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";


const visitasRef =
  collection(db, "visitas");


// ==========================================================
// CRIAR VISITA
// ==========================================================

export async function criarVisita(
  visita
) {

  const novaVisita = {

    leadId:
      visita.leadId,

    leadNome:
      visita.leadNome || "",

    data:
      visita.data,

    hora:
      visita.hora,

    consultora:
      visita.consultora ||
      visita.consultor ||
      "Samir",

    observacao:
      visita.observacao || "",

    status:
      "AGENDADA",

    criadoEm:
      serverTimestamp(),

  };


  const documento =
    await addDoc(
      visitasRef,
      novaVisita
    );


  return {

    id:
      documento.id,

    ...novaVisita,

  };

}


// ==========================================================
// ATUALIZAR VISITA
// ==========================================================

export async function atualizarVisita(
  id,
  dados
) {

  if (!id) {

    throw new Error(
      "ID da visita não informado."
    );

  }


  const visitaRef =
    doc(
      db,
      "visitas",
      id
    );


  await updateDoc(
    visitaRef,
    {

      ...dados,

      atualizadoEm:
        serverTimestamp(),

    }
  );


  return {

    id,

    ...dados,

  };

}


// ==========================================================
// BUSCAR TODAS AS VISITAS
// ==========================================================

export async function buscarVisitas() {

  const consulta =
    query(
      visitasRef,
      orderBy(
        "data",
        "asc"
      )
    );


  const snapshot =
    await getDocs(
      consulta
    );


  return snapshot.docs.map(
    (documento) => ({

      id:
        documento.id,

      ...documento.data(),

    })
  );

}


// ==========================================================
// BUSCAR VISITAS POR PERFIL (ADMIN/COORDENADOR x RECEPCIONISTA)
//
// A recepcionista vê a união de duas coisas, sem duplicar:
//
// 1. Visitas dentro do próprio TURNO (horaEntrada/horaSaida) —
//    regra original, independente de quem é o responsável.
//
// 2. Visitas de que ela é a DONA (visita.consultoraId === uid,
//    copiado de lead.responsavelUid na criação da visita) —
//    sempre visível, independente do horário.
//
// Ser dona só dá direito de VISUALIZAR fora do turno — quem
// pode confirmar/atender continua decidido só pelo turno (ver
// `allow update` em firestore.rules, não tocado por essa regra).
//
// Admin e coordenador continuam com a consulta ampla de sempre
// (buscarVisitas()).
// ==========================================================

export async function buscarVisitasPorPerfil({

  isAdmin,

  perfil,

  horaEntrada,

  horaSaida,

  uid,

}) {

  // --------------------------------------------------------
  // ADMIN / COORDENADOR — consulta ampla, igual a hoje
  // --------------------------------------------------------

  const perfilNormalizado =
    String(
      perfil || ""
    )
      .trim()
      .toLowerCase();


  if (
    isAdmin ||
    perfilNormalizado === "coordenador"
  ) {

    return buscarVisitas();

  }


  // --------------------------------------------------------
  // MONTA AS CONSULTAS APLICÁVEIS (turno e/ou dona)
  // --------------------------------------------------------

  const consultas = [];


  if (uid) {

    consultas.push(
      getDocs(
        query(

          visitasRef,

          where(
            "consultoraId",
            "==",
            uid
          )

        )
      )
    );

  }


  if (
    horaEntrada &&
    horaSaida
  ) {

    if (
      horaEntrada <= horaSaida
    ) {

      // ------------------------------------------------------
      // TURNO NORMAL
      // Ex.: 05:00 → 11:00
      // ------------------------------------------------------

      consultas.push(
        getDocs(
          query(

            visitasRef,

            where(
              "hora",
              ">=",
              horaEntrada
            ),

            where(
              "hora",
              "<=",
              horaSaida
            )

          )
        )
      );

    } else {

      // ------------------------------------------------------
      // TURNO ATRAVESSANDO MEIA-NOITE
      // Ex.: 22:00 → 06:00
      // ------------------------------------------------------

      consultas.push(

        getDocs(
          query(

            visitasRef,

            where(
              "hora",
              ">=",
              horaEntrada
            )

          )
        ),

        getDocs(
          query(

            visitasRef,

            where(
              "hora",
              "<=",
              horaSaida
            )

          )
        ),

      );

    }

  }


  // --------------------------------------------------------
  // RECEPCIONISTA SEM TURNO E SEM UID — nenhuma visita
  // --------------------------------------------------------

  if (
    consultas.length === 0
  ) {

    return [];

  }


  // --------------------------------------------------------
  // UNIÃO DE TODAS AS CONSULTAS, SEM DUPLICAR POR ID — mesmo
  // padrão de Query A/B já usado em useLeads.js.
  // --------------------------------------------------------

  const snapshots =
    await Promise.all(
      consultas
    );


  const porId =
    new Map();

  snapshots.forEach(
    (snapshot) => {

      snapshot.docs.forEach(
        (documento) => {

          porId.set(
            documento.id,
            {

              id:
                documento.id,

              ...documento.data(),

            }
          );

        }
      );

    }
  );


  return [
    ...porId.values(),
  ];

}
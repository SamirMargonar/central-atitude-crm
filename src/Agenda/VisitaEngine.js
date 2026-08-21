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
// A visibilidade da recepcionista é baseada exclusivamente no
// HORÁRIO da visita dentro do seu turno — nunca em quem é o
// responsável pelo Lead. Admin e coordenador continuam com a
// consulta ampla de sempre (buscarVisitas()).
// ==========================================================

export async function buscarVisitasPorPerfil({

  isAdmin,

  perfil,

  horaEntrada,

  horaSaida,

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
  // RECEPCIONISTA SEM TURNO DEFINIDO — nenhuma visita
  // --------------------------------------------------------

  if (
    !horaEntrada ||
    !horaSaida
  ) {

    return [];

  }


  // --------------------------------------------------------
  // TURNO NORMAL
  // Ex.: 05:00 → 11:00
  // --------------------------------------------------------

  if (
    horaEntrada <= horaSaida
  ) {

    const consulta =
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


  // --------------------------------------------------------
  // TURNO ATRAVESSANDO MEIA-NOITE
  // Ex.: 22:00 → 06:00
  //
  // Duas consultas (união), sem duplicar por id — mesmo
  // padrão de Query A/B já usado em useLeads.js.
  // --------------------------------------------------------

  const consultaA =
    query(

      visitasRef,

      where(
        "hora",
        ">=",
        horaEntrada
      )

    );


  const consultaB =
    query(

      visitasRef,

      where(
        "hora",
        "<=",
        horaSaida
      )

    );


  const [
    snapshotA,
    snapshotB,
  ] =
    await Promise.all([

      getDocs(
        consultaA
      ),

      getDocs(
        consultaB
      ),

    ]);


  const porId =
    new Map();

  [
    ...snapshotA.docs,
    ...snapshotB.docs,
  ].forEach(
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


  return [
    ...porId.values(),
  ];

}
import {
  useEffect,
  useRef,
  useState,
} from "react";

import * as firestore from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  ETAPAS,
} from "../core/LeadFlow";

import {
  criarAssinaturaResiliente,
} from "./assinaturaResiliente";

import {
  criarRastreadorDeChegadas,
} from "../utils/chegadasDeLeads";


// ==========================================================
// LEADS EM TEMPO REAL
// ==========================================================
//
// Quem pode ver o quê NÃO mudou:
//
//   - Admin / coordenador / perfil desconhecido: a coleção
//     inteira (uma escuta).
//   - Recepcionista: duas escutas com "where" — (A) leads em que
//     ela é a responsável e (B) a fila "Recebidos" sem
//     responsável, não assumida — combinadas sem duplicar por id.
//
// O que mudou (sincronização que não para):
//
//   - Cada escuta é "resiliente" (ver assinaturaResiliente.js):
//     se o Firestore encerrar a escuta por erro, ela é reaberta
//     sozinha (backoff), sem apagar a lista da tela; ao voltar a
//     internet ou a aba ficar visível há uma verificação barata
//     (contagem no servidor) que reabre uma escuta parada em
//     silêncio. Nenhum reload/F5.
//   - `chegadas`: leads que APARECERAM depois do carregamento
//     inicial (nunca o backlog que já existia ao abrir/atualizar),
//     cada um uma vez, com `seq` crescente — base do alerta
//     sonoro.
//   - `statusSincronizacao`: "conectando" | "ok" | "reconectando".
//
// `fonte` (opcional, para testes): { db, fs } no lugar do
// Firestore real.
// ==========================================================

const LIMITE_CHEGADAS_GUARDADAS = 50;

export default function useLeads({ fonte } = {}) {

  // ==========================================================
  // AUTENTICAÇÃO
  // ==========================================================

  const {
    perfilUsuario,
    isAdmin,
  } = useAuth();


  // Valores primitivos: as escutas só são refeitas quando a
  // identidade/perfil realmente muda — não a cada novo objeto
  // `perfilUsuario` (evita releituras e reinício da linha de base).
  const temPerfil =
    Boolean(perfilUsuario);

  const perfil =
    String(
      perfilUsuario?.perfil ||
      ""
    )
      .trim()
      .toLowerCase();

  const uidUsuario =
    String(
      perfilUsuario?.uid ||
      perfilUsuario?.id ||
      ""
    )
      .trim();

  const fonteRef =
    useRef(fonte);

  fonteRef.current =
    fonte;


  // `seq` das chegadas continua crescendo mesmo se as escutas forem
  // refeitas (troca de usuária/perfil): quem consome guarda o último
  // `seq` visto e nunca confunde uma chegada nova com uma antiga.
  const seqRef =
    useRef(0);


  // ==========================================================
  // LEADS
  // ==========================================================

  const [
    leads,
    setLeads,
  ] = useState([]);

  const [
    chegadas,
    setChegadas,
  ] = useState([]);

  const [
    statusSincronizacao,
    setStatusSincronizacao,
  ] = useState("conectando");


  // ==========================================================
  // CARREGAR LEADS
  // ==========================================================

  useEffect(() => {

    // --------------------------------------------------------
    // Ainda carregando perfil
    // --------------------------------------------------------

    if (!temPerfil) {

      setLeads([]);

      setChegadas([]);

      setStatusSincronizacao("conectando");

      return;

    }


    const {
      db: dbUsado,
      fs,
    } =
      fonteRef.current ||
      {
        db,
        fs: firestore,
      };


    // --------------------------------------------------------
    // Consultas desta usuária
    // --------------------------------------------------------

    const colecao =
      fs.collection(
        dbUsado,
        "leads"
      );

    // chave -> { consulta, rotuloLog }
    let definicoes;

    if (isAdmin) {

      definicoes = {

        todos: {
          consulta: colecao,
          rotulo: "ADMINISTRADOR: todos os Leads",
        },

      };

    } else if (perfil === "coordenador") {

      // Coordenador precisa enxergar todos os Leads da equipe.
      definicoes = {

        todos: {
          consulta: colecao,
          rotulo: "COORDENADOR: todos os Leads",
        },

      };

    } else if (perfil === "recepcionista") {

      definicoes = {

        // A) leads próprios
        proprios: {

          consulta: fs.query(
            colecao,
            fs.where(
              "responsavelUid",
              "==",
              uidUsuario
            )
          ),

          rotulo: "Recepcionista: Leads próprios",

        },

        // B) fila "Recebidos" — para poder "Assumir Lead"
        fila: {

          consulta: fs.query(
            colecao,
            fs.where(
              "responsavelUid",
              "==",
              ""
            ),
            fs.where(
              "etapa",
              "==",
              ETAPAS.RECEBIDO
            ),
            fs.where(
              "assumido",
              "==",
              false
            )
          ),

          rotulo: "Recepcionista: fila Recebidos",

        },

      };

    } else {

      // Perfil novo no futuro: por segurança mostra todos os
      // Leads para não esconder registros da operação.
      definicoes = {

        todos: {
          consulta: colecao,
          rotulo: `Perfil "${perfil}": todos os Leads`,
        },

      };

    }


    const chaves =
      Object.keys(definicoes);

    const rastreador =
      criarRastreadorDeChegadas(
        chaves,
        { seqInicial: seqRef.current }
      );

    setChegadas([]);

    const estados =
      Object.fromEntries(
        chaves.map(
          (chave) => [chave, "conectando"]
        )
      );


    function recalcularStatus() {

      const valores =
        Object.values(estados);

      setStatusSincronizacao(

        valores.includes("reconectando")
          ? "reconectando"
          : valores.every(
              (estado) => estado === "ok"
            )
            ? "ok"
            : "conectando"

      );

    }


    // --------------------------------------------------------
    // Abre uma escuta resiliente por consulta
    // --------------------------------------------------------

    const assinaturas =
      chaves.map(
        (chave) =>
          criarAssinaturaResiliente({

            nome: `leads/${chave}`,

            consulta:
              definicoes[chave].consulta,

            fs,

            aoSnapshot: (snapshot) => {

              const lista =
                snapshot.docs.map(
                  (documento) => ({

                    id:
                      documento.id,

                    ...documento.data(),

                  })
                );


              console.log(
                `🔄 ${definicoes[chave].rotulo}: ${lista.length}`
              );


              const resultado =
                rastreador.atualizar(
                  chave,
                  lista
                );


              setLeads(resultado.leads);


              if (resultado.chegadas.length > 0) {

                seqRef.current =
                  resultado.chegadas[
                    resultado.chegadas.length - 1
                  ].seq;

                setChegadas(
                  (anteriores) =>
                    [
                      ...anteriores,
                      ...resultado.chegadas,
                    ].slice(
                      -LIMITE_CHEGADAS_GUARDADAS
                    )
                );

              }

            },

            aoStatus: ({ estado }) => {

              estados[chave] =
                estado;

              recalcularStatus();

            },

          })
      );


    return () => {

      assinaturas.forEach(
        (assinatura) =>
          assinatura.parar()
      );

    };

  }, [
    temPerfil,
    perfil,
    uidUsuario,
    isAdmin,
  ]);


  // ==========================================================
  // RETORNO
  // ==========================================================

  return {

    leads,

    setLeads,

    chegadas,

    statusSincronizacao,

  };

}

import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  ETAPAS,
} from "../core/LeadFlow";


export default function useLeads() {

  // ==========================================================
  // AUTENTICAÇÃO
  // ==========================================================

  const {
    perfilUsuario,
    isAdmin,
  } = useAuth();


  // ==========================================================
  // LEADS
  // ==========================================================

  const [
    leads,
    setLeads,
  ] = useState([]);


  // ==========================================================
  // CARREGAR LEADS
  // ==========================================================

  useEffect(() => {

    // --------------------------------------------------------
    // Ainda carregando perfil
    // --------------------------------------------------------

    if (!perfilUsuario) {

      setLeads([]);

      return;

    }


    // --------------------------------------------------------
    // PERFIL DO USUÁRIO
    // --------------------------------------------------------

    const perfil =
      String(
        perfilUsuario?.perfil ||
        ""
      )
        .trim()
        .toLowerCase();


    // ==========================================================
    // CONSULTA AMPLA (SEM WHERE)
    //
    // Usada por admin, coordenador e, defensivamente, por
    // qualquer perfil não reconhecido — todos precisam ver
    // todos os Leads da operação.
    // ==========================================================

    function assinarConsultaAmpla(mensagemLog) {

      return onSnapshot(

        collection(
          db,
          "leads"
        ),

        (snapshot) => {

          const lista =
            snapshot.docs.map(
              (documento) => ({

                id:
                  documento.id,

                ...documento.data(),

              })
            );


          console.log(
            mensagemLog,
            lista
          );


          setLeads(lista);

        },

        (erro) => {

          console.error(
            "Erro ao carregar Leads:",
            erro
          );

          setLeads([]);

        }

      );

    }


    // ==================================================
    // ADMINISTRADOR
    // ==================================================

    if (isAdmin) {

      const unsubscribe =
        assinarConsultaAmpla(
          "👑 ADMINISTRADOR: mostrando todos os Leads."
        );

      return () => {

        unsubscribe();

      };

    }


    // ==================================================
    // COORDENADOR
    //
    // Coordenador precisa enxergar todos os Leads da
    // equipe — mesma consulta ampla do admin.
    // ==================================================

    if (
      perfil ===
      "coordenador"
    ) {

      const unsubscribe =
        assinarConsultaAmpla(
          "👨‍💼 COORDENADOR: mostrando todos os Leads."
        );

      return () => {

        unsubscribe();

      };

    }


    // ==================================================
    // RECEPCIONISTA
    //
    // Duas consultas com "where", nunca a coleção
    // inteira:
    //
    // A) Leads em que ela é a responsável (responsavelUid).
    //
    // B) Fila "Recebidos": sem responsável, etapa inicial,
    //    ainda não assumido — para poder "Assumir Lead".
    //
    // Os resultados são combinados num único estado,
    // sem duplicar por id.
    // ==================================================

    if (
      perfil ===
      "recepcionista"
    ) {

      const uidUsuario =
        String(
          perfilUsuario?.uid ||
          perfilUsuario?.id ||
          ""
        )
          .trim();


      let leadsProprios = [];

      let leadsRecebidos = [];


      function combinarEAtualizar() {

        const porId =
          new Map();

        [
          ...leadsProprios,
          ...leadsRecebidos,
        ].forEach(
          (lead) => {

            porId.set(
              lead.id,
              lead
            );

          }
        );


        setLeads(
          [...porId.values()]
        );

      }


      // ------------------------------------------------
      // QUERY A — leads próprios
      // ------------------------------------------------

      const queryA =
        query(

          collection(
            db,
            "leads"
          ),

          where(
            "responsavelUid",
            "==",
            uidUsuario
          )

        );


      const unsubscribeA =
        onSnapshot(

          queryA,

          (snapshot) => {

            leadsProprios =
              snapshot.docs.map(
                (documento) => ({

                  id:
                    documento.id,

                  ...documento.data(),

                })
              );


            console.log(
              `👩‍💼 ${perfilUsuario?.nome}: Leads próprios.`,
              leadsProprios
            );


            combinarEAtualizar();

          },

          (erro) => {

            console.error(
              "Erro ao carregar Leads próprios:",
              erro
            );

            leadsProprios = [];

            combinarEAtualizar();

          }

        );


      // ------------------------------------------------
      // QUERY B — fila Recebidos
      // ------------------------------------------------

      const queryB =
        query(

          collection(
            db,
            "leads"
          ),

          where(
            "responsavelUid",
            "==",
            ""
          ),

          where(
            "etapa",
            "==",
            ETAPAS.RECEBIDO
          ),

          where(
            "assumido",
            "==",
            false
          )

        );


      const unsubscribeB =
        onSnapshot(

          queryB,

          (snapshot) => {

            leadsRecebidos =
              snapshot.docs.map(
                (documento) => ({

                  id:
                    documento.id,

                  ...documento.data(),

                })
              );


            console.log(
              `👩‍💼 ${perfilUsuario?.nome}: fila Recebidos disponível.`,
              leadsRecebidos
            );


            combinarEAtualizar();

          },

          (erro) => {

            console.error(
              "Erro ao carregar fila Recebidos:",
              erro
            );

            leadsRecebidos = [];

            combinarEAtualizar();

          }

        );


      return () => {

        unsubscribeA();

        unsubscribeB();

      };

    }


    // ==================================================
    // OUTROS PERFIS
    //
    // Caso exista algum perfil novo no futuro, por
    // segurança mostramos os Leads para não esconder
    // registros da operação.
    // ==================================================

    const unsubscribe =
      assinarConsultaAmpla(
        `👤 Perfil "${perfilUsuario?.perfil}": mostrando todos os Leads.`
      );

    return () => {

      unsubscribe();

    };

  }, [
    perfilUsuario,
    isAdmin,
  ]);


  // ==========================================================
  // RETORNO
  // ==========================================================

  return {

    leads,

    setLeads,

  };

}
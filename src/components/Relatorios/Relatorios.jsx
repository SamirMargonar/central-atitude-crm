import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "../../styles/relatorios.css";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../../firebase/firebase";

import {
  useAuth,
} from "../../auth/AuthContext";

import {
  buscarVisitasPorPerfil,
} from "../../Agenda/VisitaEngine";

import {
  filtrarLeadsPorPeriodo,
  filtrarVisitasPorPeriodo,
  calcularIndicadores,
  calcularFunil,
  calcularDesempenhoPorConsultora,
  calcularDesempenhoPorOrigem,
  calcularDesempenhoPorObjetivo,
  visitasDoGrupo,
} from "../../core/RelatoriosCalculos";

import {
  CATEGORIAS_ORIGEM,
  CATEGORIAS_OBJETIVO,
  normalizarOrigem,
  normalizarObjetivo,
} from "../../core/RelatoriosNormalizacao";

import RelatoriosFiltros from "./RelatoriosFiltros";
import RelatoriosIndicadores from "./RelatoriosIndicadores";
import RelatoriosFunil from "./RelatoriosFunil";
import RelatoriosDesempenho from "./RelatoriosDesempenho";


// ==========================================================
// RELATÓRIOS
//
// Não cria nenhum listener novo de leads — reaproveita o array
// `leads` que App.jsx já mantém via useLeads() (Query A/B para
// recepcionista, consulta ampla para admin/coordenador).
//
// Busca `visitas` uma única vez, via buscarVisitasPorPerfil(),
// a mesma função que Dashboard.jsx já usa hoje.
//
// Não lê eventos em nenhum momento.
// ==========================================================

export default function Relatorios({

  leads = [],

}) {

  const {
    isAdmin,
    perfilUsuario,
    permissoes,
  } = useAuth();


  // ==========================================================
  // VISITAS
  // ==========================================================

  const [
    visitas,
    setVisitas,
  ] = useState([]);

  const [
    carregandoVisitas,
    setCarregandoVisitas,
  ] = useState(true);


  useEffect(() => {

    async function carregarVisitas() {

      try {

        setCarregandoVisitas(true);

        const resultado =
          await buscarVisitasPorPerfil({

            isAdmin,

            perfil:
              perfilUsuario?.perfil,

            horaEntrada:
              perfilUsuario?.horaEntrada,

            horaSaida:
              perfilUsuario?.horaSaida,

          });

        setVisitas(resultado);

      } catch (erro) {

        console.error(
          "Erro ao carregar visitas para Relatórios:",
          erro
        );

        setVisitas([]);

      } finally {

        setCarregandoVisitas(false);

      }

    }

    carregarVisitas();

  }, [
    isAdmin,
    perfilUsuario,
  ]);


  // ==========================================================
  // USUÁRIOS (só para exibir nome da consultora — só quando o
  // perfil tem relatorioGeral, que é exatamente quem a Rule
  // permite listar usuarios: admin/coordenador)
  // ==========================================================

  const [
    usuariosPorUid,
    setUsuariosPorUid,
  ] = useState({});


  useEffect(() => {

    if (!permissoes?.relatorioGeral) {

      setUsuariosPorUid({});

      return;

    }

    async function carregarUsuarios() {

      try {

        const snapshot =
          await getDocs(
            collection(db, "usuarios")
          );

        const mapa = {};

        snapshot.docs.forEach(
          (documento) => {

            mapa[documento.id] =
              {

                id:
                  documento.id,

                ...documento.data(),

              };

          }
        );

        setUsuariosPorUid(mapa);

      } catch (erro) {

        console.error(
          "Erro ao carregar usuários para Relatórios:",
          erro
        );

        setUsuariosPorUid({});

      }

    }

    carregarUsuarios();

  }, [
    permissoes?.relatorioGeral,
  ]);


  // ==========================================================
  // ESCOPO — geral (admin/coordenador) x individual (recepcionista)
  //
  // Leads: individual = responsavelUid da própria recepcionista.
  // Visitas: já vêm escopadas pelo turno via buscarVisitasPorPerfil,
  // nenhum filtro adicional é aplicado aqui.
  // ==========================================================

  const leadsNoEscopo =
    useMemo(() => {

      if (permissoes?.relatorioGeral) {
        return leads;
      }

      const uidAtual =
        perfilUsuario?.uid ||
        perfilUsuario?.id ||
        "";

      return leads.filter(
        (lead) =>
          lead.responsavelUid === uidAtual
      );

    }, [
      leads,
      permissoes?.relatorioGeral,
      perfilUsuario,
    ]);


  // ==========================================================
  // FILTROS
  // ==========================================================

  const [
    filtros,
    setFiltros,
  ] = useState({

    dataInicio:
      "",

    dataFim:
      "",

    consultoraUid:
      "",

    origem:
      "",

    objetivo:
      "",

    etapa:
      "",

  });


  const {
    dentro: leadsDentroDoPeriodo,
    semData: leadsSemData,
  } =
    useMemo(
      () =>
        filtrarLeadsPorPeriodo(
          leadsNoEscopo,
          filtros.dataInicio || null,
          filtros.dataFim || null
        ),
      [
        leadsNoEscopo,
        filtros.dataInicio,
        filtros.dataFim,
      ]
    );


  const visitasNoPeriodo =
    useMemo(
      () =>
        filtrarVisitasPorPeriodo(
          visitas,
          filtros.dataInicio || null,
          filtros.dataFim || null
        ),
      [
        visitas,
        filtros.dataInicio,
        filtros.dataFim,
      ]
    );


  // --------------------------------------------------------
  // Consultora / origem (normalizada) / objetivo (normalizado) /
  // etapa — todos combinados com E lógico, aplicados sobre os
  // leads já restritos por escopo e por período.
  // --------------------------------------------------------

  const leadsFiltrados =
    useMemo(() => {

      return leadsDentroDoPeriodo.filter(
        (lead) => {

          if (
            filtros.consultoraUid &&
            lead.responsavelUid !== filtros.consultoraUid
          ) {
            return false;
          }

          if (
            filtros.origem &&
            normalizarOrigem(lead.origem) !== filtros.origem
          ) {
            return false;
          }

          if (
            filtros.objetivo &&
            normalizarObjetivo(lead.objetivo) !== filtros.objetivo
          ) {
            return false;
          }

          if (
            filtros.etapa !== "" &&
            Number(lead.etapa ?? 0) !== Number(filtros.etapa)
          ) {
            return false;
          }

          return true;

        }
      );

    }, [
      leadsDentroDoPeriodo,
      filtros.consultoraUid,
      filtros.origem,
      filtros.objetivo,
      filtros.etapa,
    ]);


  // ==========================================================
  // CÁLCULOS
  // ==========================================================
  //
  // Geral (admin/coordenador): indicadores usam o conjunto
  // completo de visitas do período, exatamente como antes.
  //
  // Individual (recepcionista): as visitas dos cartões de
  // indicadores são restritas às que pertencem a um lead do
  // escopo dela (mesmo cruzamento por leadId já usado em
  // "Desempenho por grupo") — a visão de Agenda/turno continua
  // mostrando visitas de outras consultoras, só os indicadores
  // do relatório individual passam a contar somente as dela.
  // ==========================================================

  const visitasParaIndicadores =
    useMemo(
      () =>
        permissoes?.relatorioGeral
          ? visitasNoPeriodo
          : visitasDoGrupo(visitasNoPeriodo, leadsFiltrados),
      [
        visitasNoPeriodo,
        leadsFiltrados,
        permissoes?.relatorioGeral,
      ]
    );


  const indicadores =
    useMemo(
      () =>
        calcularIndicadores(
          leadsFiltrados,
          visitasParaIndicadores
        ),
      [
        leadsFiltrados,
        visitasParaIndicadores,
      ]
    );


  const funil =
    useMemo(
      () =>
        calcularFunil(leadsFiltrados),
      [leadsFiltrados]
    );


  const desempenhoPorConsultora =
    useMemo(
      () =>
        permissoes?.relatorioGeral
          ? calcularDesempenhoPorConsultora(leadsFiltrados, visitasNoPeriodo, usuariosPorUid)
          : [],
      [leadsFiltrados, visitasNoPeriodo, usuariosPorUid, permissoes?.relatorioGeral]
    );


  const desempenhoPorOrigem =
    useMemo(
      () =>
        calcularDesempenhoPorOrigem(leadsFiltrados, visitasNoPeriodo),
      [leadsFiltrados, visitasNoPeriodo]
    );


  const desempenhoPorObjetivo =
    useMemo(
      () =>
        calcularDesempenhoPorObjetivo(leadsFiltrados, visitasNoPeriodo),
      [leadsFiltrados, visitasNoPeriodo]
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="paginaRelatorios">

      <div className="relatoriosTitulo">

        <h1>
          📈 Relatórios
        </h1>

        <p>
          {permissoes?.relatorioGeral
            ? "Visão geral da operação comercial."
            : "Seus indicadores individuais."}
        </p>

      </div>


      <RelatoriosFiltros
        filtros={filtros}
        onChange={setFiltros}
        mostrarConsultora={!!permissoes?.relatorioGeral}
        usuariosPorUid={usuariosPorUid}
        categoriasOrigem={CATEGORIAS_ORIGEM}
        categoriasObjetivo={CATEGORIAS_OBJETIVO}
      />


      {leadsSemData.length > 0 &&
        (filtros.dataInicio || filtros.dataFim) && (

        <div className="avisoRelatorios">
          ⚠️ {leadsSemData.length} lead(s) sem data de cadastro não
          estão incluídos neste período (aparecem normalmente nos
          indicadores gerais, sem filtro de data).
        </div>

      )}


      {carregandoVisitas ? (

        <div className="relatoriosCarregando">
          Carregando visitas...
        </div>

      ) : (

        <>

          <RelatoriosIndicadores
            indicadores={indicadores}
          />

          <RelatoriosFunil
            funil={funil}
          />

          <RelatoriosDesempenho
            porConsultora={desempenhoPorConsultora}
            porOrigem={desempenhoPorOrigem}
            porObjetivo={desempenhoPorObjetivo}
            mostrarConsultora={!!permissoes?.relatorioGeral}
          />

        </>

      )}

    </div>

  );

}

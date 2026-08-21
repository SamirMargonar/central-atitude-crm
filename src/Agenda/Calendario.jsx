import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Agenda.css";

import NovaVisita from "./NovaVisita";
import DetalhesVisita from "./DetalhesVisita";

import {
  criarVisita,
  buscarVisitasPorPerfil,
} from "./VisitaEngine";

import {
  useAuth,
} from "../auth/AuthContext";


export default function Calendario({
  leads = [],
}) {

  // ==========================================================
  // USUÁRIO LOGADO
  // ==========================================================

  const {
    usuario,
    perfilUsuario,
    isAdmin,
    isRecepcionista,
    permissoes,
  } = useAuth();


  // ==========================================================
  // DATAS
  // ==========================================================

  const hoje = new Date();


  const [
    mesAtual,
    setMesAtual,
  ] = useState(
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    )
  );


  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(hoje);


  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [
    novaVisitaAberta,
    setNovaVisitaAberta,
  ] = useState(false);


  const [
    visitaSelecionada,
    setVisitaSelecionada,
  ] = useState(null);


  const [
    visitas,
    setVisitas,
  ] = useState([]);


  const [
    carregando,
    setCarregando,
  ] = useState(true);


  // ==========================================================
  // MESES
  // ==========================================================

  const nomesMeses = [

    "Janeiro",

    "Fevereiro",

    "Março",

    "Abril",

    "Maio",

    "Junho",

    "Julho",

    "Agosto",

    "Setembro",

    "Outubro",

    "Novembro",

    "Dezembro",

  ];


  // ==========================================================
  // DIAS
  // ==========================================================

  const nomesDias = [

    "Dom",

    "Seg",

    "Ter",

    "Qua",

    "Qui",

    "Sex",

    "Sáb",

  ];


  // ==========================================================
  // CARREGAR VISITAS
  // ==========================================================

  useEffect(() => {

    async function carregarVisitas() {

      try {

        setCarregando(true);


        // ------------------------------------------------------
        // Admin/coordenador: consulta ampla (igual a antes).
        // Recepcionista: consulta já vem pré-filtrada pelo
        // próprio turno (horaEntrada/horaSaida), independente
        // de quem é o responsável pelo Lead.
        // ------------------------------------------------------

        const visitasFirebase =
          await buscarVisitasPorPerfil({

            isAdmin,

            perfil:
              perfilUsuario?.perfil,

            horaEntrada:
              perfilUsuario?.horaEntrada,

            horaSaida:
              perfilUsuario?.horaSaida,

          });


        setVisitas(
          visitasFirebase
        );

      } catch (erro) {

        console.error(
          "Erro ao carregar visitas:",
          erro
        );


        alert(
          "Não foi possível carregar as visitas."
        );

      } finally {

        setCarregando(false);

      }

    }


    carregarVisitas();

  }, [
    isAdmin,
    perfilUsuario,
  ]);


  // ==========================================================
  // CONVERTER DATA
  // ==========================================================

  function formatarData(data) {

    if (!data) {

      return null;

    }


    /*
     * Firestore pode retornar Timestamp.
     */

    if (
      typeof data === "object" &&
      typeof data.toDate === "function"
    ) {

      return data.toDate();

    }


    if (
      data instanceof Date
    ) {

      return data;

    }


    if (
      typeof data !== "string"
    ) {

      return null;

    }


    const partes =
      data.split("-");


    if (
      partes.length !== 3
    ) {

      return null;

    }


    return new Date(

      Number(
        partes[0]
      ),

      Number(
        partes[1]
      ) - 1,

      Number(
        partes[2]
      )

    );

  }


  // ==========================================================
  // CONVERTER HORÁRIO PARA MINUTOS
  // ==========================================================

  function horarioParaMinutos(
    horario
  ) {

    if (!horario) {

      return null;

    }


    const partes =
      String(horario)
        .split(":");


    if (
      partes.length < 2
    ) {

      return null;

    }


    const horas =
      Number(
        partes[0]
      );


    const minutos =
      Number(
        partes[1]
      );


    if (
      Number.isNaN(horas) ||
      Number.isNaN(minutos)
    ) {

      return null;

    }


    return (
      horas * 60 +
      minutos
    );

  }


  // ==========================================================
  // VERIFICA SE O HORÁRIO ESTÁ DENTRO DO TURNO
  // ==========================================================

  function horarioDentroDoTurno(
    horaVisita,
    horaEntrada,
    horaSaida
  ) {

    const visita =
      horarioParaMinutos(
        horaVisita
      );


    const entrada =
      horarioParaMinutos(
        horaEntrada
      );


    const saida =
      horarioParaMinutos(
        horaSaida
      );


    if (
      visita === null ||
      entrada === null ||
      saida === null
    ) {

      return false;

    }


    // --------------------------------------------------------
    // TURNO NORMAL
    // Ex.: 16:00 → 22:00
    // --------------------------------------------------------

    if (
      entrada <= saida
    ) {

      return (
        visita >= entrada &&
        visita <= saida
      );

    }


    // --------------------------------------------------------
    // TURNO QUE ATRAVESSA MEIA-NOITE
    // Ex.: 22:00 → 06:00
    // --------------------------------------------------------

    return (

      visita >= entrada ||
      visita <= saida

    );

  }


  // ==========================================================
  // VERIFICA SE O USUÁRIO É DONO DA VISITA
  // ==========================================================

  function usuarioEhDonoDaVisita(
    visita
  ) {

    if (!visita) {

      return false;

    }


    const uidUsuario =
      usuario?.uid ||
      perfilUsuario?.uid ||
      null;


    const nomeUsuario =
      perfilUsuario?.nome ||
      usuario?.displayName ||
      usuario?.email ||
      "";


    // --------------------------------------------------------
    // FUTURO: UID DO DONO
    // --------------------------------------------------------

    if (
      visita.consultoraId &&
      uidUsuario
    ) {

      return (
        visita.consultoraId ===
        uidUsuario
      );

    }


    // --------------------------------------------------------
    // COMPATIBILIDADE COM VISITAS ANTIGAS
    // --------------------------------------------------------

    if (
      visita.consultora &&
      nomeUsuario
    ) {

      return (

        visita.consultora
          .trim()
          .toLowerCase() ===

        nomeUsuario
          .trim()
          .toLowerCase()

      );

    }


    return false;

  }


  // ==========================================================
  // VERIFICA SE USUÁRIO PODE VER A VISITA
  // ==========================================================

  function usuarioPodeVerVisita(
    visita
  ) {

    if (!visita) {

      return false;

    }


    // ========================================================
    // ADMIN E COORDENADOR VEEM TUDO
    // (agenda completa da equipe)
    // ========================================================

    if (permissoes.agendaCompleta) {

      return true;

    }


    // ========================================================
    // DONO DO LEAD VÊ A PRÓPRIA VISITA
    // ========================================================

    if (
      usuarioEhDonoDaVisita(
        visita
      )
    ) {

      return true;

    }


    // ========================================================
    // RECEPCIONISTA
    // ========================================================

    if (isRecepcionista) {

      // ------------------------------------------------------
      // USUÁRIO INATIVO NÃO VÊ VISITAS DE PLANTÃO
      // ------------------------------------------------------

      if (
        perfilUsuario?.ativo === false
      ) {

        return false;

      }


      // ------------------------------------------------------
      // VERIFICA PELO HORÁRIO
      // ------------------------------------------------------

      return horarioDentroDoTurno(

        visita.hora,

        perfilUsuario?.horaEntrada,

        perfilUsuario?.horaSaida

      );

    }


    return false;

  }


  // ==========================================================
  // VISITAS VISÍVEIS PARA O USUÁRIO
  // ==========================================================

  const visitasVisiveis =
    useMemo(() => {

      return visitas.filter(
        (visita) =>
          usuarioPodeVerVisita(
            visita
          )
      );

    }, [
      visitas,
      usuario,
      perfilUsuario,
      permissoes,
      isRecepcionista,
    ]);


  // ==========================================================
  // NAVEGAÇÃO DOS MESES
  // ==========================================================

  function voltarMes() {

    setMesAtual(

      new Date(

        mesAtual.getFullYear(),

        mesAtual.getMonth() - 1,

        1

      )

    );

  }


  function avancarMes() {

    setMesAtual(

      new Date(

        mesAtual.getFullYear(),

        mesAtual.getMonth() + 1,

        1

      )

    );

  }


  function irParaHoje() {

    const hojeAtual =
      new Date();


    setMesAtual(

      new Date(

        hojeAtual.getFullYear(),

        hojeAtual.getMonth(),

        1

      )

    );


    setDiaSelecionado(
      hojeAtual
    );


    setVisitaSelecionada(
      null
    );

  }


  // ==========================================================
  // DIAS DO CALENDÁRIO
  // ==========================================================

  const diasDoMes =
    useMemo(() => {

      const ano =
        mesAtual.getFullYear();


      const mes =
        mesAtual.getMonth();


      const primeiroDia =
        new Date(
          ano,
          mes,
          1
        );


      const ultimoDia =
        new Date(
          ano,
          mes + 1,
          0
        );


      const dias = [];


      for (
        let i = 0;
        i < primeiroDia.getDay();
        i++
      ) {

        const data =
          new Date(
            ano,
            mes,
            -i
          );


        dias.unshift({

          data,

          outroMes:
            true,

        });

      }


      for (
        let dia = 1;
        dia <= ultimoDia.getDate();
        dia++
      ) {

        dias.push({

          data:
            new Date(
              ano,
              mes,
              dia
            ),

          outroMes:
            false,

        });

      }


      while (
        dias.length % 7 !== 0
      ) {

        const ultimo =
          dias[
            dias.length - 1
          ].data;


        const proximo =
          new Date(

            ultimo.getFullYear(),

            ultimo.getMonth(),

            ultimo.getDate() + 1

          );


        dias.push({

          data:
            proximo,

          outroMes:
            true,

        });

      }


      return dias;

    }, [
      mesAtual,
    ]);


  // ==========================================================
  // COMPARAR DATAS
  // ==========================================================

  function mesmaData(
    data1,
    data2
  ) {

    return (

      data1.getDate() ===
        data2.getDate() &&

      data1.getMonth() ===
        data2.getMonth() &&

      data1.getFullYear() ===
        data2.getFullYear()

    );

  }


  // ==========================================================
  // ENCONTRAR LEAD
  // ==========================================================

  function encontrarLeadDaVisita(
    visita
  ) {

    if (!visita) {

      return null;

    }


    return leads.find(

      (lead) =>
        lead.id ===
        visita.leadId

    ) || null;

  }


  // ==========================================================
  // ABRIR / FECHAR DETALHES
  // ==========================================================

  function abrirDetalhesVisita(
    visita
  ) {

    if (
      visitaSelecionada?.id ===
      visita?.id
    ) {

      setVisitaSelecionada(
        null
      );

      return;

    }


    setVisitaSelecionada(
      visita
    );

  }


  function fecharDetalhesVisita() {

    setVisitaSelecionada(
      null
    );

  }


  // ==========================================================
  // ATUALIZAR VISITA NA TELA
  // ==========================================================

  function atualizarVisitaNaTela(
    visitaAtualizada
  ) {

    if (!visitaAtualizada) {

      return;

    }


    setVisitas(
      (visitasAtuais) =>

        visitasAtuais.map(

          (visita) =>

            visita.id ===
            visitaAtualizada.id

              ? {

                  ...visita,

                  ...visitaAtualizada,

                }

              : visita

        )

    );


    setVisitaSelecionada(

      (visitaAtual) =>

        visitaAtual

          ? {

              ...visitaAtual,

              ...visitaAtualizada,

            }

          : visitaAtual

    );

  }


  // ==========================================================
  // SALVAR NOVA VISITA
  // ==========================================================

  async function salvarVisita(
    visita
  ) {

    try {

      const visitaComDono = {

        ...visita,

        /*
         * Mantém a pessoa que criou/é dona do lead.
         * Não usamos o usuário do turno como dono.
         */

        consultora:
          visita.consultora ||
          perfilUsuario?.nome ||
          usuario?.displayName ||
          usuario?.email ||
          "Usuário",

        consultoraId:
          visita.consultoraId ||
          perfilUsuario?.uid ||
          usuario?.uid ||
          null,

      };


      const visitaSalva =
        await criarVisita(
          visitaComDono
        );


      setVisitas(

        (visitasAtuais) => [

          ...visitasAtuais,

          visitaSalva,

        ]

      );


      const dataVisita =
        formatarData(
          visita.data
        );


      if (dataVisita) {

        setDiaSelecionado(
          dataVisita
        );


        setMesAtual(

          new Date(

            dataVisita.getFullYear(),

            dataVisita.getMonth(),

            1

          )

        );

      }


      setNovaVisitaAberta(
        false
      );


      alert(
        "Visita agendada com sucesso!"
      );

    } catch (erro) {

      console.error(
        "Erro ao salvar visita:",
        erro
      );


      alert(
        "Não foi possível salvar a visita."
      );

    }

  }


  // ==========================================================
  // VISITAS DO DIA
  // ==========================================================

  const visitasDoDia =
    visitasVisiveis.filter(

      (visita) => {

        const dataVisita =
          formatarData(
            visita.data
          );


        if (!dataVisita) {

          return false;

        }


        return mesmaData(

          dataVisita,

          diaSelecionado

        );

      }

    );


  // ==========================================================
  // DATA FORMATADA
  // ==========================================================

  const dataFormatada =
    diaSelecionado.toLocaleDateString(

      "pt-BR",

      {

        weekday:
          "long",

        day:
          "2-digit",

        month:
          "long",

        year:
          "numeric",

      }

    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="agendaCalendario">


      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="agendaCabecalho">

        <div>

          <h1>
            📅 Agenda
          </h1>

          <p>
            Organize e acompanhe as
            visitas dos seus Leads.
          </p>

        </div>


        <button
          className="btnNovaVisita"
          onClick={() =>
            setNovaVisitaAberta(
              true
            )
          }
        >
          + Nova Visita
        </button>

      </div>


      {/* =====================================================
          INFORMAÇÃO DO TURNO
      ===================================================== */}

      {isRecepcionista && (

        <div
          style={{
            marginBottom: "18px",
            padding: "12px 15px",
            borderRadius: "10px",
            background: "#eef6ff",
            border: "1px solid #cfe3ff",
            color: "#24517a",
            fontSize: "13px",
          }}
        >

          🕐 Seu turno:

          {" "}

          <strong>

            {perfilUsuario?.horaEntrada ||
              "--:--"}

            {" → "}

            {perfilUsuario?.horaSaida ||
              "--:--"}

          </strong>

          {" "}

          • Você também vê suas próprias visitas,
          mesmo fora do turno.

        </div>

      )}


      {/* =====================================================
          CONTROLES
      ===================================================== */}

      <div className="calendarioControles">

        <button
          className="btnMes"
          onClick={voltarMes}
        >
          ‹
        </button>


        <h2>

          {
            nomesMeses[
              mesAtual.getMonth()
            ]
          }{" "}

          {
            mesAtual.getFullYear()
          }

        </h2>


        <button
          className="btnMes"
          onClick={avancarMes}
        >
          ›
        </button>


        <button
          className="btnHoje"
          onClick={irParaHoje}
        >
          Hoje
        </button>

      </div>


      {/* =====================================================
          CALENDÁRIO
      ===================================================== */}

      <div className="calendario">

        <div className="calendarioSemana">

          {nomesDias.map(
            (dia) => (

              <div
                key={dia}
                className="nomeDia"
              >

                {dia}

              </div>

            )
          )}

        </div>


        <div className="calendarioDias">

          {diasDoMes.map(

            (
              item,
              index
            ) => {

              const selecionado =
                mesmaData(

                  item.data,

                  diaSelecionado

                );


              const hojeDoCalendario =
                mesmaData(

                  item.data,

                  hoje

                );


              const visitasNesteDia =
                visitasVisiveis.filter(

                  (visita) => {

                    const dataVisita =
                      formatarData(
                        visita.data
                      );


                    if (!dataVisita) {

                      return false;

                    }


                    return mesmaData(

                      dataVisita,

                      item.data

                    );

                  }

                );


              return (

                <button
                  key={index}
                  className={`
                    diaCalendario
                    ${
                      item.outroMes
                        ? "outroMes"
                        : ""
                    }
                    ${
                      selecionado
                        ? "diaSelecionado"
                        : ""
                    }
                    ${
                      hojeDoCalendario
                        ? "diaHoje"
                        : ""
                    }
                  `}
                  onClick={() => {

                    setDiaSelecionado(
                      item.data
                    );


                    setVisitaSelecionada(
                      null
                    );


                    if (
                      item.outroMes
                    ) {

                      setMesAtual(

                        new Date(

                          item.data.getFullYear(),

                          item.data.getMonth(),

                          1

                        )

                      );

                    }

                  }}
                >

                  <span className="numeroDia">

                    {
                      item.data.getDate()
                    }

                  </span>


                  {visitasNesteDia.length >
                    0 && (

                    <span className="indicadorVisita">

                      {
                        visitasNesteDia.length
                      }

                    </span>

                  )}

                </button>

              );

            }

          )}

        </div>

      </div>


      {/* =====================================================
          VISITAS DO DIA
      ===================================================== */}

      <div className="visitasDia">

        <div className="visitasDiaHeader">

          <div>

            <h2>
              📌 Visitas
            </h2>

            <p>
              {dataFormatada}
            </p>

          </div>


          <span className="contadorVisitas">

            {
              visitasDoDia.length
            }{" "}

            {
              visitasDoDia.length === 1
                ? "visita"
                : "visitas"
            }

          </span>

        </div>


        {carregando ? (

          <div className="semVisitas">

            <div className="iconeSemVisitas">
              ⏳
            </div>

            <h3>
              Carregando visitas...
            </h3>

          </div>

        ) : visitasDoDia.length === 0 ? (

          <div className="semVisitas">

            <div className="iconeSemVisitas">
              📅
            </div>

            <h3>
              Nenhuma visita agendada
            </h3>

            <p>
              As visitas agendadas para
              este dia aparecerão aqui.
            </p>

          </div>

        ) : (

          <div className="listaVisitas">

            {[

              ...visitasDoDia,

            ]

              .sort(

                (a, b) =>

                  (
                    a.hora || ""
                  ).localeCompare(

                    b.hora || ""

                  )

              )

              .map(

                (
                  visita,
                  index
                ) => {

                  const lead =
                    encontrarLeadDaVisita(
                      visita
                    );


                  const confirmada =
                    visita.status ===
                      "CONFIRMADA" ||

                    visita.status ===
                      "confirmada" ||

                    visita.status ===
                      "Confirmada";


                  const selecionada =
                    visitaSelecionada?.id ===
                    visita.id;


                  return (

                    <div
                      className={`
                        visitaWrapper
                        ${
                          confirmada
                            ? "visitaWrapperConfirmada"
                            : "visitaWrapperPendente"
                        }
                      `}
                      key={

                        visita.id ||

                        `${visita.leadId}-${index}`

                      }
                    >

                      {/* ===================================
                          CARD DA VISITA
                      =================================== */}

                      <button
                        type="button"
                        className={`
                          cardVisita
                          ${
                            confirmada
                              ? "visitaConfirmada"
                              : "visitaPendente"
                          }
                          ${
                            selecionada
                              ? "visitaAberta"
                              : ""
                          }
                        `}
                        onClick={() =>
                          abrirDetalhesVisita(
                            visita
                          )
                        }
                      >

                        {/* HORÁRIO */}

                        <div className="horaVisita">

                          🕐{" "}

                          {
                            visita.hora ||
                            "--:--"
                          }

                        </div>


                        {/* DADOS */}

                        <div className="dadosVisita">

                          <h3>

                            👤{" "}

                            {
                              visita.leadNome ||
                              lead?.nome ||
                              "Lead"
                            }

                          </h3>


                          <p>

                            👤 Dono do Lead:{" "}

                            {
                              visita.consultora ||
                              "Não informado"
                            }

                          </p>


                          {visita.confirmadoPorNome && (

                            <p>

                              ✅ Confirmada por:{" "}

                              {
                                visita.confirmadoPorNome
                              }

                            </p>

                          )}


                          {visita.atendidoPorNome && (

                            <p>

                              🤝 Atendida por:{" "}

                              {
                                visita.atendidoPorNome
                              }

                            </p>

                          )}


                          <p
                            className={

                              confirmada

                                ? "statusVisitaConfirmada"

                                : "statusVisitaPendente"

                            }
                          >

                            {confirmada

                              ? "🟢 Visita confirmada"

                              : "🔴 Aguardando confirmação"}

                          </p>


                          {visita.observacao && (

                            <p>

                              📝{" "}

                              {
                                visita.observacao
                              }

                            </p>

                          )}


                          <span className="cliqueDetalhesVisita">

                            {

                              selecionada

                                ? "Clique para fechar detalhes ↑"

                                : "Clique para ver detalhes →"

                            }

                          </span>

                        </div>

                      </button>


                      {/* ===================================
                          DETALHES
                      =================================== */}

                      {selecionada && (

                        <DetalhesVisita

                          aberto={
                            true
                          }

                          fechar={
                            fecharDetalhesVisita
                          }

                          visita={
                            visitaSelecionada
                          }

                          lead={
                            lead
                          }

                          onAtualizar={
                            atualizarVisitaNaTela
                          }

                        />

                      )}

                    </div>

                  );

                }

              )}

          </div>

        )}

      </div>


      {/* =====================================================
          NOVA VISITA
      ===================================================== */}

      <NovaVisita

        aberto={
          novaVisitaAberta
        }

        fechar={() =>
          setNovaVisitaAberta(
            false
          )
        }

        leads={leads}

        onSalvar={
          salvarVisita
        }

      />

    </div>

  );

}
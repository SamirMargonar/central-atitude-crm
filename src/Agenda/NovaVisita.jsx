import {
  useEffect,
  useState,
} from "react";

import "./NovaVisita.css";


export default function NovaVisita({
  aberto,
  fechar,
  leads = [],
  onSalvar,
  dataInicial,
}) {

  // ==========================================================
  // CAMPOS
  // ==========================================================

  const [
    leadId,
    setLeadId,
  ] = useState("");


  const [
    data,
    setData,
  ] = useState("");


  const [
    hora,
    setHora,
  ] = useState("");


  const [
    consultora,
    setConsultora,
  ] = useState("");


  const [
    observacao,
    setObservacao,
  ] = useState("");


  // ==========================================================
  // LEAD SELECIONADO
  // ==========================================================

  const leadSelecionado =
    leads.find(
      (lead) =>
        lead.id === leadId
    );


  // ==========================================================
  // IDENTIFICAR DONO DO LEAD
  //
  // O responsável comercial é sempre o responsável ATUAL do
  // Lead (leads/{leadId}.responsavelUid). Não inventamos um
  // responsável a partir de quem está criando a visita — se o
  // Lead não tiver responsavelUid/responsavel/consultora, o
  // retorno vem vazio e salvar() bloqueia o agendamento.
  // ==========================================================

  function obterDonoDoLead(
    lead
  ) {

    if (!lead) {

      return {

        nome: "",

        id: "",

      };

    }


    // --------------------------------------------------------
    // ID DO RESPONSÁVEL
    // --------------------------------------------------------

    const id =

      lead.responsavelUid ||

      "";


    // --------------------------------------------------------
    // NOME DO RESPONSÁVEL
    // --------------------------------------------------------

    const nome =

      lead.responsavel ||

      lead.consultora ||

      "";


    return {

      nome,

      id,

    };

  }


  // ==========================================================
  // QUANDO SELECIONAR UM LEAD
  // ==========================================================

  useEffect(() => {

    if (!leadSelecionado) {

      setConsultora("");

      return;

    }


    const dono =
      obterDonoDoLead(
        leadSelecionado
      );


    setConsultora(
      dono.nome || ""
    );

  }, [
    leadId,
    leads,
  ]);


  // ==========================================================
  // RESETAR AO FECHAR
  // ==========================================================

  useEffect(() => {

    if (!aberto) {

      setLeadId("");

      setData("");

      setHora("");

      setConsultora("");

      setObservacao("");

      return;

    }


    // --------------------------------------------------------
    // Abriu com uma data já escolhida (ex.: clique no dia do
    // calendário) — pré-preenche, sem obrigar a selecionar de
    // novo.
    // --------------------------------------------------------

    if (dataInicial) {

      setData(dataInicial);

    }

  }, [
    aberto,
    dataInicial,
  ]);


  // ==========================================================
  // SALVAR
  // ==========================================================

  function salvar() {

    if (
      !leadId ||
      !data ||
      !hora
    ) {

      alert(
        "Selecione o Lead, a data e o horário."
      );

      return;

    }


    if (!leadSelecionado) {

      alert(
        "Não foi possível localizar o Lead selecionado."
      );

      return;

    }


    const dono =
      obterDonoDoLead(
        leadSelecionado
      );


    // --------------------------------------------------------
    // O LEAD PRECISA JÁ TER UM RESPONSÁVEL
    //
    // Não inventamos um responsável (nem usamos quem está
    // criando a visita como substituto). Se o Lead ainda está
    // sem responsável (ex.: fila Recebidos, não assumido),
    // bloqueamos o agendamento aqui mesmo.
    // --------------------------------------------------------

    if (
      !dono.nome
    ) {

      alert(
        "Este Lead ainda não possui um responsável definido. Assuma o Lead antes de agendar uma visita."
      );

      return;

    }


    /*
     * O dono da visita é o dono do Lead.
     *
     * Não usamos aqui quem está trabalhando no horário.
     *
     * Exemplo:
     *
     * Isabelle é dona do Lead.
     * Isabelle agenda para 19h.
     *
     * consultora = Isabelle
     *
     * Depois Ana/Naykison poderão confirmar
     * e atender sem assumir a propriedade do Lead.
     */

    const visita = {

      leadId,

      leadNome:
        leadSelecionado.nome ||
        "",

      data,

      hora,

      consultora:
        dono.nome,

      consultoraId:
        dono.id ||
        "",

      observacao,

    };


    console.log(
      "Nova visita criada:",
      visita
    );


    if (onSalvar) {

      onSalvar(
        visita
      );

    }


    // --------------------------------------------------------
    // LIMPAR FORMULÁRIO
    // --------------------------------------------------------

    setLeadId("");

    setData("");

    setHora("");

    setConsultora("");

    setObservacao("");

  }


  // ==========================================================
  // MODAL FECHADO
  // ==========================================================

  if (!aberto) {

    return null;

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="modalOverlay">


      <div className="novaVisitaModal">


        {/* ==================================================
            CABEÇALHO
        ================================================== */}

        <div className="novaVisitaHeader">

          <div>

            <h2>
              📅 Nova Visita
            </h2>

            <p>
              Agende uma visita para um Lead.
            </p>

          </div>


          <button
            type="button"
            className="novaVisitaFechar"
            onClick={fechar}
          >
            ✕
          </button>

        </div>


        {/* ==================================================
            FORMULÁRIO
        ================================================== */}

        <div className="novaVisitaBody">


          {/* ==================================================
              LEAD
          ================================================== */}

          <div className="campoNovaVisita">

            <label>
              👤 Lead
            </label>


            <select
              value={leadId}
              onChange={(e) =>
                setLeadId(
                  e.target.value
                )
              }
            >

              <option value="">
                Selecione um Lead
              </option>


              {leads.map(
                (lead) => (

                  <option
                    key={lead.id}
                    value={lead.id}
                  >

                    {lead.nome}

                  </option>

                )
              )}

            </select>

          </div>


          {/* ==================================================
              DONO DO LEAD
          ================================================== */}

          {leadSelecionado && (

            <div
              style={{
                marginTop: "-8px",
                marginBottom: "15px",
                padding: "11px 13px",
                borderRadius: "9px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontSize: "13px",
              }}
            >

              👤 <strong>Dono do Lead:</strong>{" "}

              {consultora ||
                "Não identificado"}

            </div>

          )}


          {/* ==================================================
              DATA + HORÁRIO
          ================================================== */}

          <div className="novaVisitaLinha">


            <div className="campoNovaVisita">

              <label>
                📅 Data
              </label>


              <input
                type="date"
                value={data}
                onChange={(e) =>
                  setData(
                    e.target.value
                  )
                }
              />

            </div>


            <div className="campoNovaVisita">

              <label>
                🕐 Horário
              </label>


              <input
                type="time"
                value={hora}
                onChange={(e) =>
                  setHora(
                    e.target.value
                  )
                }
              />

            </div>

          </div>


          {/* ==================================================
              RESPONSÁVEL
          ================================================== */}

          <div className="campoNovaVisita">

            <label>
              👤 Dono do Lead
            </label>


            <input
              type="text"
              value={
                consultora ||
                "Selecione um Lead"
              }
              readOnly
              style={{
                background:
                  "#f8fafc",
                cursor:
                  "not-allowed",
              }}
            />

          </div>


          {/* ==================================================
              EXPLICAÇÃO
          ================================================== */}

          {leadSelecionado && (

            <div
              style={{
                marginTop: "-8px",
                marginBottom: "15px",
                color: "#64748b",
                fontSize: "12px",
                lineHeight: "1.5",
              }}
            >

              💡 O dono do Lead permanece
              responsável por ele. A recepcionista
              que estiver trabalhando no horário da
              visita poderá confirmar e atender o
              cliente.

            </div>

          )}


          {/* ==================================================
              OBSERVAÇÃO
          ================================================== */}

          <div className="campoNovaVisita">

            <label>
              📝 Observações
            </label>


            <textarea
              placeholder="Ex.: Cliente quer conhecer a musculação primeiro..."
              value={observacao}
              onChange={(e) =>
                setObservacao(
                  e.target.value
                )
              }
            />

          </div>


          {/* ==================================================
              BOTÕES
          ================================================== */}

          <div className="novaVisitaBotoes">


            <button
              type="button"
              className="btnCancelarVisita"
              onClick={fechar}
            >
              Cancelar
            </button>


            <button
              type="button"
              className="btnSalvarVisita"
              onClick={salvar}
            >
              📅 Agendar Visita
            </button>

          </div>

        </div>

      </div>

    </div>

  );

}
import { useState } from "react";

import LeadActionModal from "../LeadActionModal";

import {
  atualizarLead,
  registrarEvento,
} from "../../../core/EventEngine";

import {
  useAuth,
} from "../../../auth/AuthContext";

import usePlanos from "../../../hooks/usePlanos";

import SeletorPlano from "../../SeletorPlano";

import {
  aplicarSnapshotNaMatricula,
  calcularVencimentoPorMeses,
  duracaoEmMeses,
  extrairSnapshot,
  montarSnapshotPlano,
  nomeDaMatricula,
} from "../../../utils/planos";


// ==========================================================
// EDITAR MATRÍCULA
// ==========================================================
//
// Corrige uma matrícula já confirmada (ex.: plano errado) sem
// criar uma nova matrícula, sem alterar a etapa do lead e sem
// tocar em confirmada/data/hora/consultor/status — só plano,
// dataInicio (com recálculo de dataVencimento) e observação.
// ==========================================================

export default function EditarMatriculaAction({
  lead,
  setLead,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [aberto, setAberto] =
    useState(false);

  const [plano, setPlano] =
    useState("MENSAL");

  const [dataInicio, setDataInicio] =
    useState("");

  const [observacao, setObservacao] =
    useState("");


  // ==========================================================
  // PLANO ATUAL DO CONTRATO (a partir do instantâneo gravado)
  //
  // Os valores/nome/duração do contrato vêm de lead.matricula (o que
  // foi contratado na época), NUNCA do catálogo atual. Matrículas
  // antigas (só `plano: "MENSAL"`) são lidas pelos códigos legados.
  // ==========================================================

  const matriculaAtual =
    lead?.matricula || {};

  const idPlanoAtual =
    matriculaAtual.planoId ||
    matriculaAtual.plano ||
    "";

  const planoDoContrato =
    idPlanoAtual
      ? {
          id: idPlanoAtual,
          nome: nomeDaMatricula(matriculaAtual),
          categoriaId:
            matriculaAtual.planoCategoriaId ||
            "convencionais",
          duracaoMeses:
            duracaoEmMeses(matriculaAtual),
          valorCentavos:
            matriculaAtual.valorCentavos,
          taxaAdesaoCentavos:
            matriculaAtual.taxaAdesaoCentavos,
          condicoes:
            matriculaAtual.condicoes || "",
        }
      : null;

  const catalogoPlanos = usePlanos({
    ativo: aberto,
    manter: planoDoContrato,
  });

  // Na lista, o plano atual aparece com os valores do CONTRATO.
  const listaPlanos =
    planoDoContrato
      ? catalogoPlanos.lista.map(
          (item) =>
            item.id === idPlanoAtual
              ? { ...item, ...planoDoContrato }
              : item
        )
      : catalogoPlanos.lista;

  const planoEscolhido =
    listaPlanos.find(
      (item) => item.id === plano
    ) || null;

  const mantendoPlanoDoContrato =
    !!plano && plano === idPlanoAtual;

  // Vencimento: plano mantido => duração do CONTRATO; plano trocado =>
  // duração do plano escolhido.
  function calcularVencimento(
    data,
    escolhido
  ) {

    return calcularVencimentoPorMeses(
      data,
      duracaoEmMeses(escolhido)
    );

  }


  // ==========================================================
  // FORMATA DATA
  // ==========================================================

  function formatarData(
    data
  ) {

    if (!data) {
      return "Não informada";
    }

    const partes =
      data.split("-");

    if (
      partes.length !== 3
    ) {

      return data;

    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

  }


  // ==========================================================
  // ABRE, PRÉ-PREENCHENDO COM OS VALORES ATUAIS
  // ==========================================================

  function abrir() {

    setPlano(
      lead?.matricula?.planoId ||
      lead?.matricula?.plano ||
      "MENSAL"
    );

    setDataInicio(
      lead?.matricula?.dataInicio ||
      ""
    );

    setObservacao(
      lead?.matricula?.observacao ||
      ""
    );

    setAberto(true);

  }


  // ==========================================================
  // SALVAR EDIÇÃO
  // ==========================================================

  async function salvarEdicao() {

    if (!plano || !planoEscolhido) {
      alert(
        "Selecione o plano do cliente."
      );
      return;
    }


    if (!dataInicio) {

      alert(
        "Informe a data de início da matrícula."
      );

      return;

    }


    try {

      const matriculaAnterior =
        lead?.matricula || {};

      const dataVencimento =
        calcularVencimento(
          dataInicio,
          planoEscolhido
        );

      if (!dataVencimento) {
        alert(
          "Não foi possível calcular o vencimento: o plano não tem duração definida."
        );
        return;
      }

      // ========================================================
      // PRESERVA confirmada/data/hora/consultor/status. Plano
      // MANTIDO => o instantâneo do contrato fica como está (nenhum
      // valor do catálogo atual é copiado). Plano TROCADO => novo
      // instantâneo do plano escolhido.
      // ========================================================
      const snapshotNovo =
        mantendoPlanoDoContrato
          ? extrairSnapshot(matriculaAnterior)
          : montarSnapshotPlano(
              planoEscolhido,
              catalogoPlanos.categorias
            );

      const matriculaAtualizada =
        mantendoPlanoDoContrato
          ? {
              ...matriculaAnterior,
              dataInicio,
              dataVencimento,
              observacao,
            }
          : {
              ...aplicarSnapshotNaMatricula(
                matriculaAnterior,
                snapshotNovo
              ),
              dataInicio,
              dataVencimento,
              observacao,
            };


      await atualizarLead(
        lead.id,
        {

          matricula:
            matriculaAtualizada,

        }
      );


      if (setLead) {

        setLead({

          ...lead,

          matricula:
            matriculaAtualizada,

        });

      }


      // ========================================================
      // REGISTRA NA TIMELINE
      // ========================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "MATRICULA_EDITADA",

        usuario:
          nomeResponsavel,

        descricao:
          `${nomeResponsavel} editou a matrícula de ${lead.nome}.`,

        dados: {

          planoAnterior:
            matriculaAnterior.plano,
          planoNovo:
            matriculaAtualizada.plano,
          snapshotAnterior:
            extrairSnapshot(matriculaAnterior),
          snapshotNovo:
            extrairSnapshot(matriculaAtualizada),

          dataInicioAnterior:
            matriculaAnterior.dataInicio,

          dataInicioNovo:
            dataInicio,

          dataVencimentoAnterior:
            matriculaAnterior.dataVencimento,

          dataVencimentoNovo:
            dataVencimento,

        },

      });


      setAberto(false);


      alert(
        "✏️ Matrícula atualizada com sucesso!"
      );


    } catch (erro) {

      console.error(
        "Erro ao editar matrícula:",
        erro
      );

      alert(
        "Não foi possível editar a matrícula."
      );

    }

  }


  // ==========================================================
  // VENCIMENTO PREVISTO
  // ==========================================================

  const dataVencimentoPreview =
    calcularVencimento(
      dataInicio,
      planoEscolhido
    );


  return (

    <>

      <button
        type="button"
        className="btnAcaoPrincipal"
        onClick={abrir}
      >
        ✏️ Editar Matrícula
      </button>


      <LeadActionModal
        aberto={aberto}
        titulo="Editar Matrícula"
      >

        <p>

          Corrija a matrícula de{" "}

          <strong>
            {lead?.nome}
          </strong>

          .

        </p>


        {/* ======================================
            PLANO
        ====================================== */}

        <label>
          🎓 Plano contratado
        </label>

        <SeletorPlano
          value={plano}
          onChange={setPlano}
          lista={listaPlanos}
          categorias={catalogoPlanos.categorias}
          fallback={catalogoPlanos.fallback}
          carregando={catalogoPlanos.carregando}
        />


        {/* ======================================
            DATA DE INÍCIO
        ====================================== */}

        <label>
          📅 Data de início
        </label>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) =>
            setDataInicio(
              e.target.value
            )
          }
        />


        {/* ======================================
            VENCIMENTO RECALCULADO
        ====================================== */}

        <div
          style={{
            background: "#f0efff",
            borderRadius: "10px",
            padding: "14px",
            marginTop: "10px",
            marginBottom: "10px",
            border: "1px solid #d8d5ff",
          }}
        >

          <strong>
            🔄 Novo vencimento
          </strong>

          <div
            style={{
              marginTop: "7px",
              color: "#5b52e8",
              fontWeight: "700",
            }}
          >

            {formatarData(
              dataVencimentoPreview
            )}

          </div>

        </div>


        {/* ======================================
            OBSERVAÇÃO
        ====================================== */}

        <label>
          📝 Observações da matrícula
        </label>

        <textarea
          rows={5}
          placeholder="Ex.: Plano contratado, condição especial, observações..."
          value={observacao}
          onChange={(e) =>
            setObservacao(
              e.target.value
            )
          }
        />


        {/* ======================================
            BOTÕES
        ====================================== */}

        <div className="leadActionButtons">

          <button
            className="btnCancelar"
            onClick={() =>
              setAberto(false)
            }
          >
            Cancelar
          </button>


          <button
            className="btnSalvar"
            onClick={
              salvarEdicao
            }
          >
            ✏️ Salvar Alterações
          </button>

        </div>

      </LeadActionModal>

    </>

  );

}

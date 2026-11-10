import {
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
  registrarEvento,
} from "../core/EventEngine";

import {
  criarServicoTelefones,
} from "../services/telefonesLeads";

import {
  MENSAGEM_TELEFONE_DUPLICADO,
  MENSAGEM_TELEFONE_INVALIDO,
  telefoneValido,
} from "../utils/telefoneLead";

import LeadDetailsModal from "./LeadDetailsModal/LeadDetailsModal";

import "../styles/leadModal.css";


const {
  serverTimestamp,
} = firestore;


// ==========================================================
// TELEFONE ÚNICO — não pode existir dois leads com o mesmo
// telefone. O lead e o índice do telefone são gravados no MESMO
// lote atômico e as Firestore Rules recusam o lote se o número
// já pertence a outro lead (ver services/telefonesLeads.js).
// ==========================================================

const servicoTelefones =
  criarServicoTelefones({
    db,
    fs: firestore,
  });


export default function LeadModal({
  aberto,
  fechar,
  modoGerencial = false,
}) {

  // ==========================================================
  // USUÁRIO LOGADO
  // ==========================================================

  const {
    usuario,
    perfilUsuario,
  } = useAuth();


  // ==========================================================
  // DADOS DO USUÁRIO
  // ==========================================================

  const nomeUsuario =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    "Usuário";


  const perfil =
    perfilUsuario?.perfil ||
    "";


  const uidUsuario =
    perfilUsuario?.uid ||
    perfilUsuario?.id ||
    usuario?.uid ||
    "";


  // ==========================================================
  // CAMPOS
  // ==========================================================

  const [
    nome,
    setNome,
  ] = useState("");


  const [
    telefone,
    setTelefone,
  ] = useState("");


  const [
    idade,
    setIdade,
  ] = useState("");


  const [
    objetivo,
    setObjetivo,
  ] = useState("");


  const [
    origem,
    setOrigem,
  ] = useState("");


  const [
    salvando,
    setSalvando,
  ] = useState(false);


  // ==========================================================
  // CADASTRO GERENCIAL — só usado quando modoGerencial === true
  // ==========================================================

  // Duplicidade/telefone inválido: { tipo, mensagem, existente }
  const [
    erroTelefone,
    setErroTelefone,
  ] = useState(null);

  const [
    leadConsultado,
    setLeadConsultado,
  ] = useState(null);


  // UID REAL da sessão autenticada (Firebase Auth) — não o campo
  // `uid` do documento de usuário, que pode estar divergente.
  const uidReal =
    usuario?.uid ||
    "";

  const perfilPodeCadastroGerencial =
    perfil === "admin" ||
    perfil === "coordenador";


  // ==========================================================
  // SE MODAL FECHADO
  // ==========================================================

  if (!aberto) {

    return null;

  }


  // ==========================================================
  // MODO GERENCIAL BLOQUEADO PARA OUTROS PERFIS
  // ==========================================================

  if (
    modoGerencial &&
    !perfilPodeCadastroGerencial
  ) {

    return null;

  }


  // ==========================================================
  // LIMPAR FORMULÁRIO
  // ==========================================================

  function limparFormulario() {

    setNome("");

    setTelefone("");

    setIdade("");

    setObjetivo("");

    setOrigem("");

    setErroTelefone(null);

  }


  // ==========================================================
  // ERRO DE TELEFONE (duplicado / inválido) — bloqueia o
  // salvamento e mostra a mensagem. Devolve true se tratou.
  // ==========================================================

  function tratarErroDeTelefone(erro) {

    if (erro?.codigo === "TELEFONE_DUPLICADO") {

      setErroTelefone({
        tipo:
          "duplicado",
        mensagem:
          MENSAGEM_TELEFONE_DUPLICADO,
        existente:
          erro.lead || null,
      });

      return true;

    }

    if (erro?.codigo === "TELEFONE_INVALIDO") {

      setErroTelefone({
        tipo:
          "invalido",
        mensagem:
          MENSAGEM_TELEFONE_INVALIDO,
        existente:
          null,
      });

      return true;

    }

    return false;

  }


  // ==========================================================
  // SALVAR LEAD GERENCIAL
  //
  // O lead nasce JÁ ASSUMIDO e sob responsabilidade de quem
  // cadastrou (admin/coordenador), então não atende às condições
  // da fila compartilhada (responsavelUid vazio + etapa 0 + não
  // assumido) nem às do alerta de novo lead (etapa 0 + não
  // assumido). `cadastroGerencial: true` permite identificá-lo
  // depois. A validação dos campos já foi feita por salvarLead().
  // ==========================================================

  async function salvarLeadGerencial() {

    if (
      !perfilPodeCadastroGerencial ||
      !uidReal
    ) {

      alert(
        "Somente administrador ou coordenador, com sessão ativa, pode usar o Cadastro Gerencial."
      );

      return;

    }


    try {

      setSalvando(true);

      setErroTelefone(null);


      // ----------------------------------------------------
      // CRIA O LEAD (+ índice único do telefone, no mesmo lote
      // atômico). Telefone de outro lead => nada é gravado.
      // ----------------------------------------------------

      const leadRef =
        await servicoTelefones.criarLead(
          {

            nome:
              nome.trim(),

            telefone:
              telefone.trim(),

            idade:
              Number(idade),

            objetivo,

            origem,

            etapa:
              0,

            status:
              "Novo Lead",

            cadastradoPor:
              nomeUsuario,

            cadastradoPorUid:
              uidReal,

            cadastradoPorPerfil:
              perfil,

            assumido:
              true,

            responsavel:
              nomeUsuario,

            consultora:
              nomeUsuario,

            responsavelUid:
              uidReal,

            assumidoEm:
              serverTimestamp(),

            cadastroGerencial:
              true,

            createdAt:
              serverTimestamp(),

          },
          {
            uid:
              uidReal,
          }
        );


      // ----------------------------------------------------
      // TIMELINE — evento novo (append-only), pelo padrão
      // existente de registrarEvento()
      // ----------------------------------------------------

      let eventoRegistrado = true;

      try {

        await registrarEvento({

          leadId:
            leadRef.id,

          tipo:
            "CADASTRO_GERENCIAL",

          usuario:
            nomeUsuario,

          descricao:
            `Lead cadastrado pela gestão (${perfil}) e mantido sob responsabilidade de ${nomeUsuario}. Não entrou na fila das recepcionistas.`,

          dados: {
            cadastroGerencial:
              true,
            perfilCadastro:
              perfil,
          },

        });

      } catch (erroEvento) {

        eventoRegistrado = false;

        console.error(
          "Lead gerencial criado, mas o evento da timeline falhou:",
          erroEvento
        );

      }


      alert(
        eventoRegistrado
          ? "Lead cadastrado e mantido sob sua responsabilidade. Ele não entra na fila das recepcionistas."
          : "Lead cadastrado e mantido sob sua responsabilidade, mas o registro na timeline falhou. Avise o suporte."
      );


      limparFormulario();

      setErroTelefone(null);

      fechar();

    } catch (erro) {

      if (tratarErroDeTelefone(erro)) {

        return;

      }

      console.error(
        "Erro ao cadastrar Lead gerencial:",
        erro
      );

      alert(
        "Não foi possível cadastrar o Lead."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // SALVAR LEAD
  // ==========================================================

  async function salvarLead() {

    // --------------------------------------------------------
    // VALIDAÇÕES
    // --------------------------------------------------------

    if (!nome.trim()) {

      alert(
        "Informe o nome do Lead."
      );

      return;

    }


    if (!telefone.trim()) {

      alert(
        "Informe o telefone do Lead."
      );

      return;

    }


    if (!telefoneValido(telefone)) {

      setErroTelefone({
        tipo:
          "invalido",
        mensagem:
          MENSAGEM_TELEFONE_INVALIDO,
        existente:
          null,
      });

      return;

    }


    if (!idade) {

      alert(
        "Selecione a idade do Lead."
      );

      return;

    }


    if (!origem) {

      alert(
        "Selecione a origem do Lead."
      );

      return;

    }


    // --------------------------------------------------------
    // CADASTRO GERENCIAL — fluxo separado; o cadastro normal
    // (abaixo) não é alterado.
    // --------------------------------------------------------

    if (modoGerencial) {

      await salvarLeadGerencial();

      return;

    }


    try {

      setSalvando(true);

      setErroTelefone(null);


      // ======================================================
      // REGRA DE RESPONSABILIDADE
      //
      // RECEPCIONISTA:
      // → Lead fica automaticamente com ela.
      //
      // COORDENADOR:
      // → Lead vai para Recebidos.
      //
      // ADMIN:
      // → Lead vai para Recebidos.
      // ======================================================

      const ehRecepcionista =
        perfil === "recepcionista";


      const responsavelInicial =
        ehRecepcionista
          ? nomeUsuario
          : "";


      // ======================================================
      // DADOS DO LEAD
      // ======================================================

      const dadosLead = {

        // ----------------------------------------------------
        // DADOS DO LEAD
        // ----------------------------------------------------

        nome:
          nome.trim(),

        telefone:
          telefone.trim(),

        idade:
          Number(idade),

        objetivo,

        origem,


        // ----------------------------------------------------
        // JORNADA
        // ----------------------------------------------------

        etapa:
          0,

        status:
          "Novo Lead",


        // ----------------------------------------------------
        // QUEM CADASTROU
        // ----------------------------------------------------

        cadastradoPor:
          nomeUsuario,

        cadastradoPorUid:
          uidUsuario,

        cadastradoPorPerfil:
          perfil,


        // ----------------------------------------------------
        // RESPONSABILIDADE
        // ----------------------------------------------------

        assumido:
          ehRecepcionista,

        responsavel:
          responsavelInicial,

        consultora:
          responsavelInicial,

        responsavelUid:
          ehRecepcionista
            ? uidUsuario
            : "",

        assumidoEm:
          ehRecepcionista
            ? serverTimestamp()
            : null,


        // ----------------------------------------------------
        // DATA DE CRIAÇÃO
        // ----------------------------------------------------

        createdAt:
          serverTimestamp(),

      };


      // ======================================================
      // SALVAR NO FIRESTORE
      // ======================================================

      const leadRef =
        await servicoTelefones.criarLead(
          dadosLead,
          {
            uid:
              uidReal,
          }
        );


      console.log(
        "Lead criado com sucesso:",
        leadRef.id
      );


      // ======================================================
      // MENSAGEM
      // ======================================================

      if (ehRecepcionista) {

        alert(
          `Lead cadastrado e atribuído para ${nomeUsuario}.`
        );

      } else {

        alert(
          "Lead cadastrado e enviado para a fila de atendimento."
        );

      }


      // ======================================================
      // LIMPAR
      // ======================================================

      limparFormulario();

      fechar();


    } catch (erro) {

      if (tratarErroDeTelefone(erro)) {

        return;

      }

      console.error(
        "Erro ao cadastrar Lead:",
        erro
      );

      alert(
        "Não foi possível cadastrar o Lead."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="modalOverlay"
    >

      <div
        className="leadModal"
      >

        {/* ==================================================
            CABEÇALHO
        ================================================== */}

        <div
          className="leadModalHeader"
        >

          <div>

            <h2>
              {modoGerencial
                ? "🗂️ Cadastro Gerencial de Leads"
                : "👤 Novo Lead"}
            </h2>

            <p>
              {modoGerencial
                ? "Cadastre um contato que ficará sob responsabilidade da gestão."
                : "Cadastre um novo cliente."}
            </p>

          </div>


          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
          >
            ✕
          </button>

        </div>


        {/* ==================================================
            FORMULÁRIO
        ================================================== */}

        <div
          className="leadModalBody"
        >

          {/* =================================================
              NOME
          ================================================= */}

          <div
            className="campo"
          >

            <label>
              Nome
            </label>

            <input
              type="text"
              value={nome}
              onChange={(e) =>
                setNome(
                  e.target.value
                )
              }
              placeholder="Nome completo"
            />

          </div>


          {/* =================================================
              TELEFONE
          ================================================= */}

          <div
            className="campo"
          >

            <label>
              Telefone
            </label>

            <input
              type="tel"
              value={telefone}
              onChange={(e) => {
                setTelefone(
                  e.target.value
                );
                setErroTelefone(null);
              }}
              placeholder="(41) 99999-9999"
            />

          </div>


          {/* =================================================
              IDADE
          ================================================= */}

          <div
            className="campo"
          >

            <label>
              Idade
            </label>

            <select
              value={idade}
              onChange={(e) =>
                setIdade(
                  e.target.value
                )
              }
            >

              <option value="">
                Selecione a idade
              </option>

              {Array.from(
                {
                  length: 90,
                },
                (_, index) => {

                  const valor =
                    index + 1;

                  return (

                    <option
                      key={valor}
                      value={valor}
                    >
                      {valor} anos
                    </option>

                  );

                }
              )}

            </select>

          </div>


          {/* =================================================
              OBJETIVO
          ================================================= */}

          <div
            className="campo"
          >

            <label>
              Objetivo
            </label>

            <select
              value={objetivo}
              onChange={(e) =>
                setObjetivo(
                  e.target.value
                )
              }
            >

              <option value="">
                Objetivo ainda não definido
              </option>

              <option value="Viva Forma">
                Viva Forma
              </option>

              <option value="Viva Leve">
                Viva Leve
              </option>

              <option value="Viva Saúde">
                Viva Saúde
              </option>

              <option value="Viva Movimento">
                Viva Movimento
              </option>

            </select>

          </div>


          {/* =================================================
              ORIGEM
          ================================================= */}

          <div
            className="campo"
          >

            <label>
              Origem
            </label>

            <select
              value={origem}
              onChange={(e) =>
                setOrigem(
                  e.target.value
                )
              }
            >

              <option value="">
                Selecione a origem
              </option>

              <option value="Site">
                Site
              </option>

              <option value="Instagram">
                Instagram
              </option>

              <option value="Espontânea">
                Espontânea
              </option>

              <option value="Indicação">
                Indicação
              </option>

              <option value="Campanha">
                Campanha
              </option>

            </select>

          </div>


          {/* =================================================
              INFORMAÇÃO DE RESPONSABILIDADE
          ================================================= */}

          {modoGerencial ? (

            <div
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  "10px",
                background:
                  "#f5f3ff",
                border:
                  "1px solid #ddd6fe",
                color:
                  "#5b21b6",
                fontSize:
                  "13px",
                fontWeight:
                  "600",
              }}
            >

              🗂️ Este Lead ficará sob a sua
              responsabilidade e não entrará na
              fila das recepcionistas. Depois ele
              poderá ser encaminhado a uma
              recepcionista pela transferência.

            </div>

          ) : perfil === "recepcionista" ? (

            <div
              style={{
                padding:
                  "12px 14px",

                borderRadius:
                  "10px",

                background:
                  "#ecfdf5",

                border:
                  "1px solid #bbf7d0",

                color:
                  "#166534",

                fontSize:
                  "13px",

                fontWeight:
                  "600",
              }}
            >

              👩‍💼 Este Lead será
              automaticamente atribuído
              a você.

            </div>

          ) : (

            <div
              style={{
                padding:
                  "12px 14px",

                borderRadius:
                  "10px",

                background:
                  "#eff6ff",

                border:
                  "1px solid #bfdbfe",

                color:
                  "#1e40af",

                fontSize:
                  "13px",

                fontWeight:
                  "600",
              }}
            >

              📥 Este Lead ficará disponível
              para a equipe assumir.

            </div>

          )}


          {/* =================================================
              TELEFONE DUPLICADO / INVÁLIDO (todos os cadastros)
              O salvamento é BLOQUEADO — não existe "cadastrar
              mesmo assim". Nada é alterado, mesclado ou excluído
              no lead que já tem o número.
          ================================================= */}

          {erroTelefone && (

            <div
              role="alert"
              className="avisoTelefone"
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  "10px",
                background:
                  "#fef2f2",
                border:
                  "1px solid #fecaca",
                color:
                  "#991b1b",
                fontSize:
                  "13px",
                fontWeight:
                  "600",
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "8px",
              }}
            >

              <span>
                {erroTelefone.mensagem}
              </span>

              {erroTelefone.existente && (

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap:
                      "10px",
                  }}
                >

                  <span>
                    {erroTelefone.existente.nome || "Sem nome"}
                    {" — "}
                    {erroTelefone.existente.responsavel ||
                      erroTelefone.existente.consultora ||
                      "Sem responsável"}
                  </span>

                  {modoGerencial && (

                    <button
                      type="button"
                      onClick={() =>
                        setLeadConsultado(
                          erroTelefone.existente
                        )
                      }
                    >
                      Consultar cadastro
                    </button>

                  )}

                </div>

              )}

            </div>

          )}


          {/* =================================================
              BOTÕES
          ================================================= */}

          <div
            className="leadModalActions"
          >

            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
            >

              Cancelar

            </button>


            <button
              type="button"
              onClick={
                salvarLead
              }
              disabled={
                salvando
              }
            >

              {salvando
                ? "Salvando..."
                : modoGerencial
                  ? "Cadastrar Lead Gerencial"
                  : "Cadastrar Lead"}

            </button>

          </div>

        </div>

      </div>


      {/* ===================================================
          CONSULTA DO CADASTRO EXISTENTE (modo gerencial)
          — mesmo modal de detalhes já usado em "Consultar Lead"
      =================================================== */}

      {modoGerencial && leadConsultado && (

        <LeadDetailsModal
          lead={leadConsultado}
          onClose={() =>
            setLeadConsultado(null)
          }
        />

      )}

    </div>

  );

}
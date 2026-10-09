import {
  useState,
} from "react";

import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  registrarEvento,
} from "../core/EventEngine";

import LeadDetailsModal from "./LeadDetailsModal/LeadDetailsModal";

import "../styles/leadModal.css";


// ==========================================================
// TELEFONE — CHAVE DE COMPARAÇÃO (só usada no modo gerencial)
//
// Ignora formatação (espaços, hífen, parênteses, "+"), zeros à
// esquerda e o código do país (55). Com DDD, compara DDD + os
// 8 últimos dígitos, para que "41 99618-3695" e "41 9618-3695"
// (sem o 9 extra) sejam reconhecidos como o mesmo número.
// ==========================================================

function chaveTelefone(valor) {

  let digitos =
    String(valor || "")
      .replace(/\D/g, "")
      .replace(/^0+/, "");

  if (
    digitos.startsWith("55") &&
    digitos.length >= 12
  ) {

    digitos =
      digitos.slice(2);

  }

  return digitos.length >= 10
    ? digitos.slice(0, 2) +
      digitos.slice(-8)
    : digitos;

}


async function buscarLeadsComMesmoTelefone(
  telefone
) {

  const chave =
    chaveTelefone(telefone);

  if (!chave) {
    return [];
  }

  const snapshot =
    await getDocs(
      collection(
        db,
        "leads"
      )
    );

  return snapshot.docs
    .map((documento) => ({
      id:
        documento.id,
      ...documento.data(),
    }))
    .filter(
      (lead) =>
        chaveTelefone(
          lead.telefone
        ) === chave
    );

}


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

  const [
    duplicados,
    setDuplicados,
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

  async function salvarLeadGerencial(
    ignorarDuplicidade
  ) {

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


      // ----------------------------------------------------
      // TELEFONE JÁ CADASTRADO? (só avisa — nunca altera,
      // mescla ou exclui o lead existente)
      // ----------------------------------------------------

      if (!ignorarDuplicidade) {

        let encontrados = [];

        try {

          encontrados =
            await buscarLeadsComMesmoTelefone(
              telefone
            );

        } catch (erroBusca) {

          console.error(
            "Erro ao verificar telefone duplicado:",
            erroBusca
          );

          const continuar =
            window.confirm(
              "Não foi possível verificar se este telefone já está cadastrado. Deseja cadastrar mesmo assim?"
            );

          if (!continuar) {
            return;
          }

        }

        if (encontrados.length > 0) {

          setDuplicados({
            telefone:
              telefone.trim(),
            lista:
              encontrados,
          });

          return;

        }

      }


      const duplicidadeIgnorada =
        ignorarDuplicidade &&
        !!duplicados?.lista?.length;


      // ----------------------------------------------------
      // CRIA O LEAD
      // ----------------------------------------------------

      const leadRef =
        await addDoc(
          collection(
            db,
            "leads"
          ),
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
            duplicidadeIgnorada,
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

      setDuplicados(null);

      fechar();

    } catch (erro) {

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

      await salvarLeadGerencial(false);

      return;

    }


    try {

      setSalvando(true);


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
        await addDoc(

          collection(
            db,
            "leads"
          ),

          dadosLead

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
              onChange={(e) =>
                setTelefone(
                  e.target.value
                )
              }
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
              POSSÍVEL TELEFONE DUPLICADO (modo gerencial)
              Só avisa. Nada é excluído, mesclado ou alterado.
          ================================================= */}

          {modoGerencial &&
            duplicados?.telefone === telefone.trim() &&
            duplicados.lista.length > 0 && (

            <div
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  "10px",
                background:
                  "#fffbeb",
                border:
                  "1px solid #fde68a",
                color:
                  "#92400e",
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
                ⚠️ Este telefone já está cadastrado.
                Consulte o cadastro existente antes de
                continuar:
              </span>

              {duplicados.lista.map(
                (existente) => (

                  <div
                    key={existente.id}
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
                      {existente.nome || "Sem nome"}
                      {" — "}
                      {existente.responsavel ||
                        existente.consultora ||
                        "Sem responsável"}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setLeadConsultado(
                          existente
                        )
                      }
                    >
                      Consultar cadastro
                    </button>

                  </div>

                )
              )}

              <div>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    salvarLeadGerencial(true)
                  }
                >
                  Cadastrar mesmo assim
                </button>

              </div>

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
import {
  useState,
} from "react";

import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  db,
} from "../firebase/firebase";

import {
  useAuth,
} from "../auth/AuthContext";

import "../styles/leadModal.css";


export default function LeadModal({
  aberto,
  fechar,
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
  // SE MODAL FECHADO
  // ==========================================================

  if (!aberto) {

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
              👤 Novo Lead
            </h2>

            <p>
              Cadastre um novo cliente.
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

            </select>

          </div>


          {/* =================================================
              INFORMAÇÃO DE RESPONSABILIDADE
          ================================================= */}

          {perfil === "recepcionista" ? (

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
                : "Cadastrar Lead"}

            </button>

          </div>

        </div>

      </div>

    </div>

  );

}
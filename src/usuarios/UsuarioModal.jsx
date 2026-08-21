import {
  useEffect,
  useState,
} from "react";

import {
  initializeApp,
  deleteApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  atualizarUsuario,
} from "./UsuarioService";


// ==========================================================
// MODAL DE USUÁRIO
// ==========================================================

export default function UsuarioModal({

  aberto,

  fechar,

  usuario,

}) {

  // ==========================================================
  // MODO EDIÇÃO
  // ==========================================================
  //
  // Quando "usuario" é informado, o modal abre em modo
  // Editar Usuário em vez de Novo Usuário.
  //
  // Nesta etapa, e-mail e senha NÃO são editáveis.
  // ==========================================================

  const modoEdicao =
    !!usuario;

  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    senha,
    setSenha,
  ] = useState("");

  const [
    confirmarSenha,
    setConfirmarSenha,
  ] = useState("");

  const [
    mostrarSenha,
    setMostrarSenha,
  ] = useState(false);

  const [
    mostrarConfirmarSenha,
    setMostrarConfirmarSenha,
  ] = useState(false);

  const [
    perfil,
    setPerfil,
  ] = useState("recepcionista");

  const [
    horaEntrada,
    setHoraEntrada,
  ] = useState("");

  const [
    horaSaida,
    setHoraSaida,
  ] = useState("");

  const [
    ativo,
    setAtivo,
  ] = useState(true);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");


  // ==========================================================
  // LIMPAR FORMULÁRIO
  // ==========================================================

  function limparFormulario() {

    setNome("");

    setEmail("");

    setSenha("");

    setConfirmarSenha("");

    setMostrarSenha(false);

    setMostrarConfirmarSenha(false);

    setPerfil("recepcionista");

    setHoraEntrada("");

    setHoraSaida("");

    setAtivo(true);

    setErro("");

  }


  // ==========================================================
  // PREENCHER FORMULÁRIO AO ABRIR
  // ==========================================================
  //
  // Modo edição: carrega os dados do usuário selecionado.
  // Modo criação: garante que o formulário comece limpo.
  //
  // Senha e e-mail nunca são preenchidos a partir de um
  // usuário existente — essa etapa não mexe nesses campos.
  // ==========================================================

  useEffect(() => {

    if (!aberto) {
      return;
    }


    if (usuario) {

      setNome(
        usuario.nome || ""
      );

      setEmail(
        usuario.email || ""
      );

      setPerfil(
        usuario.perfil ||
        "recepcionista"
      );

      setHoraEntrada(
        usuario.horaEntrada || ""
      );

      setHoraSaida(
        usuario.horaSaida || ""
      );

      setAtivo(
        usuario.ativo !== false
      );

      setSenha("");

      setConfirmarSenha("");

      setMostrarSenha(false);

      setMostrarConfirmarSenha(false);

      setErro("");

    } else {

      limparFormulario();

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aberto,
    usuario,
  ]);


  // ==========================================================
  // FECHAR
  // ==========================================================

  function fecharModal() {

    if (salvando) {
      return;
    }

    limparFormulario();

    fechar();

  }


  // ==========================================================
  // CADASTRAR USUÁRIO
  // ==========================================================

  async function cadastrarUsuario(evento) {

    evento.preventDefault();

    setErro("");


    // ========================================================
    // VALIDAÇÕES
    // ========================================================

    if (!nome.trim()) {

      setErro(
        "Informe o nome do usuário."
      );

      return;

    }


    if (!email.trim()) {

      setErro(
        "Informe o e-mail do usuário."
      );

      return;

    }


    if (!senha) {

      setErro(
        "Informe uma senha."
      );

      return;

    }


    if (senha.length < 6) {

      setErro(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      return;

    }


    if (!confirmarSenha) {

      setErro(
        "Confirme a senha antes de cadastrar."
      );

      return;

    }


    if (senha !== confirmarSenha) {

      setErro(
        "As senhas não coincidem. Verifique e tente novamente."
      );

      return;

    }


    if (!horaEntrada || !horaSaida) {

      setErro(
        "Informe o horário de entrada e saída."
      );

      return;

    }


    setSalvando(true);


    // ========================================================
    // FIREBASE AUTH SECUNDÁRIO
    //
    // IMPORTANTE:
    // Não usamos o auth principal para criar o usuário,
    // porque isso poderia trocar o login do Samir.
    // ========================================================

    let appSecundario = null;


    try {

      /*
       * Pegamos a configuração do Firebase
       * diretamente do app que já está autenticado.
       */

      const firebaseConfig =
        auth.app.options;


      /*
       * Criamos uma segunda instância do Firebase.
       */

      appSecundario =
        initializeApp(
          firebaseConfig,
          `central-attitude-cadastro-${Date.now()}`
        );


      const authSecundario =
        getAuth(
          appSecundario
        );


      // ======================================================
      // CRIA LOGIN
      // ======================================================

      const resultado =
        await createUserWithEmailAndPassword(
          authSecundario,
          email.trim(),
          senha
        );


      const novoUsuario =
        resultado.user;


      // ======================================================
      // NOME DO USUÁRIO NO AUTH
      // ======================================================

      await updateProfile(
        novoUsuario,
        {
          displayName:
            nome.trim(),
        }
      );


      // ======================================================
      // FIRESTORE
      // ======================================================

      await setDoc(

        doc(
          db,
          "usuarios",
          novoUsuario.uid
        ),

        {

          nome:
            nome.trim(),

          email:
            email.trim(),

          perfil,

          horaEntrada,

          horaSaida,

          ativo,

          uid:
            novoUsuario.uid,

          criadoEm:
            serverTimestamp(),

          atualizadoEm:
            serverTimestamp(),

        }

      );


      // ======================================================
      // FINALIZA
      // ======================================================

      if (appSecundario) {

        await deleteApp(
          appSecundario
        );

        appSecundario = null;

      }


      limparFormulario();

      fechar();


    } catch (error) {

      console.error(
        "Erro ao cadastrar usuário:",
        error
      );


      // ======================================================
      // MENSAGENS AMIGÁVEIS
      // ======================================================

      let mensagem =
        "Não foi possível cadastrar o usuário.";


      if (
        error.code ===
        "auth/email-already-in-use"
      ) {

        mensagem =
          "Este e-mail já está cadastrado no Firebase.";

      }


      else if (
        error.code ===
        "auth/invalid-email"
      ) {

        mensagem =
          "O e-mail informado é inválido.";

      }


      else if (
        error.code ===
        "auth/weak-password"
      ) {

        mensagem =
          "A senha é muito fraca. Use pelo menos 6 caracteres.";

      }


      else if (
        error.code ===
        "permission-denied"
      ) {

        mensagem =
          "O Firebase não permitiu gravar o usuário no Firestore.";

      }


      else if (
        error.code ===
        "auth/network-request-failed"
      ) {

        mensagem =
          "Falha de conexão com o Firebase.";

      }


      setErro(mensagem);


      // ======================================================
      // LIMPA APP SECUNDÁRIO
      // ======================================================

      if (appSecundario) {

        try {

          await deleteApp(
            appSecundario
          );

        } catch {

          // Não fazer nada.

        }

      }

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // SALVAR EDIÇÃO DO USUÁRIO
  // ==========================================================
  //
  // Atualiza somente os campos permitidos nesta etapa:
  // nome, perfil, horaEntrada, horaSaida, ativo.
  //
  // E-mail e senha não são alterados aqui.
  //
  // Reutiliza atualizarUsuario() do UsuarioService.js,
  // que já grava no Firestore com atualizadoEm atualizado.
  // ==========================================================

  async function salvarEdicaoUsuario(evento) {

    evento.preventDefault();

    setErro("");


    if (!nome.trim()) {

      setErro(
        "Informe o nome do usuário."
      );

      return;

    }


    if (!horaEntrada || !horaSaida) {

      setErro(
        "Informe o horário de entrada e saída."
      );

      return;

    }


    setSalvando(true);


    try {

      await atualizarUsuario(
        usuario.id,
        {

          nome:
            nome.trim(),

          perfil,

          horaEntrada,

          horaSaida,

          ativo,

        }
      );


      fechar();


    } catch (error) {

      console.error(
        "Erro ao atualizar usuário:",
        error
      );

      setErro(
        "Não foi possível salvar as alterações."
      );

    } finally {

      setSalvando(false);

    }

  }


  // ==========================================================
  // VALIDAÇÃO DA SENHA (EM TEMPO REAL)
  // ==========================================================
  //
  // Usado para bloquear o botão de envio enquanto a senha
  // e a confirmação não estiverem válidas.
  // ==========================================================

  const senhaValida =
    senha.length >= 6 &&
    confirmarSenha.length > 0 &&
    senha === confirmarSenha;


  // ==========================================================
  // NÃO MOSTRAR
  // ==========================================================

  if (!aberto) {

    return null;

  }


  // ==========================================================
  // MODAL
  // ==========================================================

  return (

    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow:
            "0 25px 70px rgba(0,0,0,0.35)",
        }}
      >

        {/* ==================================================
            CABEÇALHO
        ================================================== */}

        <div
          style={{
            padding: "24px 28px",
            borderBottom:
              "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >

          <div>

            <h2
              style={{
                margin: 0,
                color: "#172554",
                fontSize: "24px",
              }}
            >
              {modoEdicao
                ? "✏️ Editar Usuário"
                : "👤 Novo Usuário"}
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {modoEdicao
                ? "Atualize os dados do usuário."
                : "Cadastre um administrador ou recepcionista."}
            </p>

          </div>


          <button

            type="button"

            onClick={fecharModal}

            disabled={salvando}

            style={{
              border: "none",
              background: "#f1f5f9",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              fontSize: "20px",
              cursor:
                salvando
                  ? "not-allowed"
                  : "pointer",
            }}

          >
            ✕

          </button>

        </div>


        {/* ==================================================
            FORMULÁRIO
        ================================================== */}

        <form
          onSubmit={
            modoEdicao
              ? salvarEdicaoUsuario
              : cadastrarUsuario
          }
          style={{
            padding: "28px",
          }}
        >

          {/* =================================================
              ERRO
          ================================================= */}

          {erro && (

            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                border:
                  "1px solid #fecaca",
                borderRadius: "10px",
                padding: "13px 15px",
                marginBottom: "20px",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >

              ⚠️ {erro}

            </div>

          )}


          {/* =================================================
              NOME
          ================================================= */}

          <label
            style={{
              display: "block",
              marginBottom: "18px",
            }}
          >

            <span
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "700",
                color: "#334155",
              }}
            >
              👤 Nome
            </span>


            <input

              type="text"

              value={nome}

              onChange={(evento) =>
                setNome(
                  evento.target.value
                )
              }

              placeholder="Ex.: Isabelle"

              disabled={salvando}

              style={estiloInput}

            />

          </label>


          {/* =================================================
              E-MAIL
          ================================================= */}

          <label
            style={{
              display: "block",
              marginBottom: "18px",
            }}
          >

            <span
              style={labelStyle}
            >
              📧 E-mail
            </span>


            <input

              type="email"

              value={email}

              onChange={(evento) =>
                setEmail(
                  evento.target.value
                )
              }

              placeholder="exemplo@email.com"

              disabled={
                salvando ||
                modoEdicao
              }

              style={
                modoEdicao
                  ? {
                      ...estiloInput,
                      background: "#f1f5f9",
                      color: "#94a3b8",
                      cursor: "not-allowed",
                    }
                  : estiloInput
              }

            />


            {modoEdicao && (

              <span
                style={{
                  display: "block",
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                O e-mail não pode ser alterado nesta etapa.
              </span>

            )}

          </label>


          {/* =================================================
              SENHA
              (SOMENTE NO CADASTRO — NÃO EDITÁVEL AQUI)
          ================================================= */}

          {!modoEdicao && (

            <>

              <label
                style={{
                  display: "block",
                  marginBottom: "18px",
                }}
              >

                <span
                  style={labelStyle}
                >
                  🔐 Senha
                </span>


                <div
                  style={{
                    position: "relative",
                  }}
                >

                  <input

                    type={
                      mostrarSenha
                        ? "text"
                        : "password"
                    }

                    value={senha}

                    onChange={(evento) =>
                      setSenha(
                        evento.target.value
                      )
                    }

                    placeholder="Mínimo de 6 caracteres"

                    disabled={salvando}

                    style={{
                      ...estiloInput,
                      paddingRight: "48px",
                    }}

                  />


                  <button

                    type="button"

                    onClick={() =>
                      setMostrarSenha(
                        (valor) => !valor
                      )
                    }

                    disabled={salvando}

                    title={
                      mostrarSenha
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }

                    style={
                      estiloBotaoSenha
                    }

                  >

                    {mostrarSenha
                      ? "🙈"
                      : "👁️"}

                  </button>

                </div>

              </label>


              {/* =================================================
                  CONFIRMAR SENHA
              ================================================= */}

              <label
                style={{
                  display: "block",
                  marginBottom: "18px",
                }}
              >

                <span
                  style={labelStyle}
                >
                  🔒 Confirmar senha
                </span>


                <div
                  style={{
                    position: "relative",
                  }}
                >

                  <input

                    type={
                      mostrarConfirmarSenha
                        ? "text"
                        : "password"
                    }

                    value={
                      confirmarSenha
                    }

                    onChange={(evento) =>
                      setConfirmarSenha(
                        evento.target.value
                      )
                    }

                    placeholder="Digite a senha novamente"

                    disabled={salvando}

                    style={{
                      ...estiloInput,
                      paddingRight: "48px",
                      borderColor:
                        confirmarSenha &&
                        senha !== confirmarSenha
                          ? "#ef4444"
                          : "#cbd5e1",
                    }}

                  />


                  <button

                    type="button"

                    onClick={() =>
                      setMostrarConfirmarSenha(
                        (valor) => !valor
                      )
                    }

                    disabled={salvando}

                    title={
                      mostrarConfirmarSenha
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }

                    style={
                      estiloBotaoSenha
                    }

                  >

                    {mostrarConfirmarSenha
                      ? "🙈"
                      : "👁️"}

                  </button>

                </div>


                {/* =================================================
                    FEEDBACK DA SENHA
                ================================================= */}

                {confirmarSenha && senha === confirmarSenha && (

                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#15803d",
                    }}
                  >
                    ✅ As senhas coincidem.
                  </div>

                )}


                {confirmarSenha && senha !== confirmarSenha && (

                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#dc2626",
                    }}
                  >
                    ⚠️ As senhas não coincidem.
                  </div>

                )}

              </label>

            </>

          )}


          {/* =================================================
              PERFIL
          ================================================= */}

          <label
            style={{
              display: "block",
              marginBottom: "18px",
            }}
          >

            <span
              style={labelStyle}
            >
              👔 Perfil
            </span>


            <select

              value={perfil}

              onChange={(evento) =>
                setPerfil(
                  evento.target.value
                )
              }

              disabled={salvando}

              style={estiloInput}

            >

              <option value="recepcionista">
                Recepcionista
              </option>

              <option value="admin">
                Administrador
              </option>

            </select>

          </label>


          {/* =================================================
              HORÁRIOS
          ================================================= */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "14px",
              marginBottom: "18px",
            }}
          >

            <label>

              <span
                style={labelStyle}
              >
                🕐 Entrada
              </span>


              <input

                type="time"

                value={horaEntrada}

                onChange={(evento) =>
                  setHoraEntrada(
                    evento.target.value
                  )
                }

                disabled={salvando}

                style={estiloInput}

              />

            </label>


            <label>

              <span
                style={labelStyle}
              >
                🕐 Saída
              </span>


              <input

                type="time"

                value={horaSaida}

                onChange={(evento) =>
                  setHoraSaida(
                    evento.target.value
                  )
                }

                disabled={salvando}

                style={estiloInput}

              />

            </label>

          </div>


          {/* =================================================
              ATIVO
          ================================================= */}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "25px",
              cursor: "pointer",
            }}
          >

            <input

              type="checkbox"

              checked={ativo}

              onChange={(evento) =>
                setAtivo(
                  evento.target.checked
                )
              }

              disabled={salvando}

              style={{
                width: "18px",
                height: "18px",
              }}

            />

            <span
              style={{
                color: "#334155",
                fontWeight: "600",
              }}
            >
              Usuário ativo
            </span>

          </label>


          {/* =================================================
              BOTÕES
          ================================================= */}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >

            <button

              type="button"

              onClick={fecharModal}

              disabled={salvando}

              style={{
                padding: "13px 20px",
                borderRadius: "10px",
                border:
                  "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontWeight: "700",
                cursor:
                  salvando
                    ? "not-allowed"
                    : "pointer",
              }}

            >
              Cancelar
            </button>


            <button

              type="submit"

              disabled={
                salvando ||
                (!modoEdicao && !senhaValida)
              }

              style={{
                padding: "13px 22px",
                border: "none",
                borderRadius: "10px",
                background:
                  salvando ||
                  (!modoEdicao && !senhaValida)
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#ffffff",
                fontWeight: "700",
                cursor:
                  salvando ||
                  (!modoEdicao && !senhaValida)
                    ? "not-allowed"
                    : "pointer",
              }}

            >

              {salvando

                ? (modoEdicao
                    ? "⏳ Salvando..."
                    : "⏳ Cadastrando...")

                : (modoEdicao
                    ? "💾 Salvar Alterações"
                    : "✅ Cadastrar Usuário")}

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}


// ==========================================================
// ESTILOS
// ==========================================================

const labelStyle = {

  display: "block",

  marginBottom: "7px",

  fontWeight: "700",

  color: "#334155",

};


const estiloInput = {

  width: "100%",

  boxSizing: "border-box",

  padding: "13px 14px",

  border:
    "1px solid #cbd5e1",

  borderRadius: "10px",

  fontSize: "15px",

  color: "#1e293b",

  background: "#ffffff",

  outline: "none",

};


const estiloBotaoSenha = {

  position: "absolute",

  right: "10px",

  top: "50%",

  transform: "translateY(-50%)",

  border: "none",

  background: "transparent",

  cursor: "pointer",

  fontSize: "19px",

  padding: "5px",

};
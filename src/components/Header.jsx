import "../styles/header.css";

export default function Header({
  abrirModal,
  usuario,
  perfilUsuario,
}) {

  // ==========================================================
  // NOME DO USUÁRIO
  // ==========================================================

  const nomeUsuario =
    usuario?.displayName ||
    usuario?.nome ||
    perfilUsuario?.nome ||
    usuario?.email?.split("@")[0] ||
    "Usuário";


  return (

    <header className="header">


      <div>

        <h1>
          CENTRAL ATTITUDE
        </h1>

        <p>
          Gestão de Leads
        </p>

      </div>


      <div className="headerDireita">


        <button

          className="btnNovoLead"

          onClick={abrirModal}

        >

          ➕ Novo Lead

        </button>


        <div className="usuario">

          👋 Olá, {nomeUsuario}

        </div>


      </div>


    </header>

  );

}
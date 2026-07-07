import "../styles/header.css";

export default function Header({ abrirModal }) {
  return (
    <header className="header">

      <div>
        <h1>CENTRAL ATTITUDE</h1>
        <p>Gestão de Leads</p>
      </div>

      <div className="headerDireita">

        <button
          className="btnNovoLead"
          onClick={abrirModal}
        >
          ➕ Novo Lead
        </button>

        <div className="usuario">
          👋 Olá, Samir
        </div>

      </div>

    </header>
  );
}
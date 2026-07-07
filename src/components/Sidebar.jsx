import "../styles/sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <h2 className="logo">
        🏋️ ATTITUDE
        <span>CENTRAL</span>
      </h2>

      <nav>
        <a href="#">🏠 Dashboard</a>
        <a href="#">👥 Leads</a>
        <a href="#">📅 Agenda</a>
        <a href="#">📈 Relatórios</a>
        <a href="#">⚙️ Configurações</a>
      </nav>

      <button className="btnSair">
        🚪 Sair
      </button>
    </aside>
  );
}
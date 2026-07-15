import LeadTimer from "./LeadTimer";

export default function TimelineLead({ lead }) {
  return (
    <div
      style={{
        marginTop: "15px",
        paddingTop: "10px",
        borderTop: "1px solid #e5e5e5",
      }}
    >
      <div style={{ marginBottom: "8px" }}>
        <strong>⏱ Lead:</strong>{" "}
        <LeadTimer createdAt={lead.createdAt} />
      </div>

      <div style={{ marginBottom: "8px" }}>
        <strong>👤 Assumido:</strong>{" "}
        {lead.assumidoEm ? "✅ Registrado" : "—"}
      </div>

      <div style={{ marginBottom: "8px" }}>
        <strong>💬 Primeiro contato:</strong> —
      </div>

      <div style={{ marginBottom: "8px" }}>
        <strong>🤝 Negociação:</strong> —
      </div>

      <div style={{ marginBottom: "8px" }}>
        <strong>📅 Agendamento:</strong> —
      </div>

      <div>
        <strong>🏆 Matrícula:</strong> —
      </div>
    </div>
  );
}
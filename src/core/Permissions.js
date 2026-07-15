// ===============================
// PERFIS DO SISTEMA
// ===============================

export const PERFIS = {

  ADMIN: "Administrador",

  COORDENADOR: "Coordenador",

  CONSULTORA: "Consultora",

};

// ===============================
// PERMISSÕES PADRÃO
// ===============================

export const PERMISSOES = {

  Administrador: {
    dashboard: true,
    leads: true,
    financeiro: true,
    agenda: true,
    relatorios: true,
    usuarios: true,
    configuracoes: true,
    transferirLead: true,
    editarResponsavel: true,
    excluirObservacao: true,
  },

  Coordenador: {
    dashboard: true,
    leads: true,
    financeiro: true,
    agenda: true,
    relatorios: true,
    usuarios: true,
    configuracoes: true,
    transferirLead: true,
    editarResponsavel: true,
    excluirObservacao: false,
  },

  Consultora: {
    dashboard: true,
    leads: true,
    financeiro: false,
    agenda: true,
    relatorios: false,
    usuarios: false,
    configuracoes: false,
    transferirLead: false,
    editarResponsavel: false,
    excluirObservacao: false,
  },

};

// ===============================
// VERIFICA PERMISSÃO
// ===============================

export function pode(usuario, permissao) {

  if (!usuario) return false;

  const regras = PERMISSOES[usuario.perfil];

  if (!regras) return false;

  return regras[permissao] || false;

}
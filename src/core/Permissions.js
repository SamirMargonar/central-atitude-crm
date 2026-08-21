// ==========================================================
// PERFIS DO SISTEMA
// ==========================================================
//
// Estes são os únicos valores reais gravados em
// usuarios/{uid}.perfil no Firestore. Sempre minúsculos.
// ==========================================================

export const PERFIS = {

  ADMIN: "admin",

  COORDENADOR: "coordenador",

  RECEPCIONISTA: "recepcionista",

};


// ==========================================================
// PERMISSÕES GRANULARES POR PERFIL
// ==========================================================
//
// Cada chave representa uma ação concreta do sistema.
// Um valor "false" pode significar tanto "não permitido"
// quanto "funcionalidade ainda não existe no sistema"
// (ex.: excluirUsuarioPermanente, que hoje não existe
// para nenhum perfil).
// ==========================================================

export const PERMISSOES = {

  // ========================================================
  // ADMINISTRADOR
  // ========================================================

  admin: {

    // --- Leads ---
    verTodosLeads: true,
    criarLead: true,
    editarLead: true,
    assumirLead: true,
    transferirLead: true,

    // --- Agenda / Renovações ---
    agendaCompleta: true,
    renovacoes: true,

    // --- Relatórios ---
    acessarRelatorios: true,
    relatorioGeral: true,
    relatorioIndividual: true,

    // --- Usuários ---
    acessarUsuarios: true,
    criarUsuario: true,
    editarUsuario: true,
    ativarDesativarUsuario: true,
    excluirUsuarioPermanente: false,

    // --- Estrutural ---
    configuracoesEstruturais: true,
    alterarPermissoes: true,
    alterarAdministrador: true,

    // --- Notificações ---
    // Admin nunca recebe alerta sonoro de novo lead.
    alertaSonoroNovoLead: false,

  },


  // ========================================================
  // COORDENADOR
  // ========================================================

  coordenador: {

    // --- Leads ---
    verTodosLeads: true,
    criarLead: true,
    editarLead: true,
    assumirLead: true,
    transferirLead: true,

    // --- Agenda / Renovações ---
    agendaCompleta: true,
    renovacoes: true,

    // --- Relatórios ---
    acessarRelatorios: true,
    relatorioGeral: true,
    relatorioIndividual: true,

    // --- Usuários ---
    acessarUsuarios: true,
    criarUsuario: true,
    editarUsuario: true,
    ativarDesativarUsuario: true,
    excluirUsuarioPermanente: false,

    // --- Estrutural ---
    // Configurações estruturais, permissões e o administrador
    // são exclusivos do perfil admin.
    configuracoesEstruturais: false,
    alterarPermissoes: false,
    alterarAdministrador: false,

    // --- Notificações ---
    // Coordenador nunca recebe alerta sonoro de novo lead.
    alertaSonoroNovoLead: false,

  },


  // ========================================================
  // RECEPCIONISTA
  // ========================================================

  recepcionista: {

    // --- Leads ---
    // Vê apenas os próprios leads + a fila de Recebidos
    // sem responsável (regra tratada em useLeads.js).
    verTodosLeads: false,
    criarLead: true,
    editarLead: true,
    assumirLead: true,
    transferirLead: false,

    // --- Agenda / Renovações ---
    // Agenda segue as regras de turno já existentes
    // (não é acesso total como admin/coordenador).
    agendaCompleta: false,
    renovacoes: true,

    // --- Relatórios ---
    acessarRelatorios: true,
    relatorioGeral: false,
    relatorioIndividual: true,

    // --- Usuários ---
    acessarUsuarios: false,
    criarUsuario: false,
    editarUsuario: false,
    ativarDesativarUsuario: false,
    excluirUsuarioPermanente: false,

    // --- Estrutural ---
    configuracoesEstruturais: false,
    alterarPermissoes: false,
    alterarAdministrador: false,

    // --- Notificações ---
    // Somente recepcionista pode ouvir o alerta de novo lead
    // (e mesmo assim, nunca de um lead que ela mesma cadastrou —
    // essa exceção pontual continua tratada em
    // NotificationCenter.jsx, não faz parte da matriz de perfil).
    alertaSonoroNovoLead: true,

  },

};


// ==========================================================
// PERMISSÕES VAZIAS
// ==========================================================
//
// Usado como fallback seguro enquanto o perfil ainda não
// foi carregado, ou para um perfil desconhecido.
// Todas as ações ficam bloqueadas por padrão.
// ==========================================================

const PERMISSOES_VAZIAS = Object.fromEntries(
  Object.keys(PERMISSOES.admin).map(
    (chave) => [chave, false]
  )
);


// ==========================================================
// OBTÉM A PERMISSÃO DE UM PERFIL
// ==========================================================

export function obterPermissoes(perfil) {

  const chave =
    String(perfil || "")
      .trim()
      .toLowerCase();

  return (
    PERMISSOES[chave] ||
    PERMISSOES_VAZIAS
  );

}


// ==========================================================
// VERIFICA PERMISSÃO
// ==========================================================
//
// pode("recepcionista", "transferirLead") → false
// pode("admin", "acessarUsuarios") → true
// ==========================================================

export function pode(perfil, acao) {

  const regras =
    obterPermissoes(perfil);

  return regras[acao] === true;

}

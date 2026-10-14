#!/usr/bin/env bash
# Executa as suítes de transferência em massa no Firestore Emulator local.
# NÃO toca produção e NÃO altera o projeto: instala as dependências de teste
# numa pasta temporária fora do repositório.
#
# Pré-requisitos: Node 20+, Java (Emulator) e acesso à rede para o npm/npx.
# Uso:  tests/transferencia-em-massa/run.sh [rules|servico|ui|todas]
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
export REPO="$(cd "$AQUI/../.." && pwd)"
WORK="${TME_WORK:-${TMPDIR:-/tmp}/tme-testes}"
SUITE="${1:-todas}"
[ -d /opt/homebrew/opt/openjdk/bin ] && export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

mkdir -p "$WORK"; cd "$WORK"
if [ ! -d node_modules/@firebase/rules-unit-testing ]; then
  [ -f package.json ] || npm init -y >/dev/null
  npm pkg set type=module >/dev/null
  npm install --no-audit --no-fund @firebase/rules-unit-testing firebase@^13 jsdom >/dev/null
fi
cp "$AQUI"/*.mjs .
cat > firebase.json <<'JSON'
{"firestore":{"rules":"firestore.rules"},"emulators":{"firestore":{"port":8085},"ui":{"enabled":false}}}
JSON
cp "$REPO/firestore.rules" firestore.rules

rodar() {  # $1 = arquivo de teste
  echo; echo "################ $1"
  npx --yes firebase-tools emulators:exec --only firestore --project demo-tme "node $1" 2>&1 | grep -E "^(OK|FALHA|TOTAL|===|ERRO|Error)" || true
}
case "$SUITE" in
  rules)   rodar rules.test.mjs; rodar atendimento.rules.test.mjs; rodar atendimento.integracao.test.mjs ;;
  servico) rodar servico.test.mjs ;;
  ui)      node ui.test.mjs ;;
  atendimento) rodar atendimento.rules.test.mjs; rodar atendimento.integracao.test.mjs; node atendimento.ui.test.mjs; node matriculas.titularidade.test.mjs ;;
  todas)   rodar rules.test.mjs; rodar atendimento.rules.test.mjs; rodar atendimento.integracao.test.mjs; rodar servico.test.mjs; node ui.test.mjs; node atendimento.ui.test.mjs; node matriculas.titularidade.test.mjs ;;
esac

# Testes — Transferência em Massa de Leads

Suítes que validam as Firestore Rules, o serviço e a interface da transferência
em massa. **Nada aqui toca produção**: tudo roda no Firestore Emulator local ou
em jsdom. O projeto não tem dependências de teste; o `run.sh` instala o que
precisa numa pasta temporária **fora do repositório** (`$TMPDIR/tme-testes`).

## Como rodar

```bash
tests/transferencia-em-massa/run.sh            # todas
tests/transferencia-em-massa/run.sh rules      # só as Rules
tests/transferencia-em-massa/run.sh servico    # só o serviço real
tests/transferencia-em-massa/run.sh atendimento # só as Rules do atendimento compartilhado
tests/transferencia-em-massa/run.sh ui         # só a interface
```

Requisitos: Node 20+, Java (o Emulator do Firestore usa), rede para o npm/npx.

## O que cada arquivo cobre

| Arquivo | O que valida |
|---|---|
| `rules.test.mjs` | Quem pode trocar o dono de um lead (apenas os 2 UIDs reais); destino ativo; **reversão** para consultora inativa sem liberar transferência normal; proteção de `transferenciasEmMassa` e `itens` (leitura, autoria, imutabilidade, exclusão); `consultoraId` das visitas; fluxos existentes preservados. |
| `servico.test.mjs` | `src/services/transferenciaEmMassa.js` contra o Emulator **com as Rules reais**: prévia, execução por lead, visitas, falha parcial, retomada, repetição, lead alterado por terceiros, reversão, legados sem `responsavel`, gerenciais, autorização. |
| `atendimento.rules.test.mjs` | **Atendimento compartilhado** (Rules): recepcionista ATIVA atende lead de outra consultora por operações explícitas (observação, não fechamento, fechamento/matrícula, reagendamento, comparecimento/não comparecimento) com autoria verificada (UID + nome + instante do servidor), sem mudar `responsavelUid/responsavel/consultora`; conta inativa, campos fora da operação, evento/lead/visita excluídos ou editados, lead da fila, visita já baixada, visitas antigas de carteira transferida (leitura/baixa pela nova titular sem reescrever `consultoraId`), regressão da titular e das transferências. Cada negativo tem um CONTROLE aceito. |
| `atendimento.integracao.test.mjs` | Código REAL do app (`registrarEvento`, `atualizarLead`, `registrarAtendimento`, `atualizarVisita`, `buscarVisitasDosLeadsDaTitular`) rodando contra o Emulator com as Rules reais: prova que os payloads do app são aceitos para quem atende e negados para autoria falsa / conta inativa. Só o módulo `firebase/firebase` (config de produção) é trocado por uma instância do Emulator. |
| `matriculas.titularidade.test.mjs` | **Métrica de matrículas**: a matrícula conta para a TITULAR do lead (Relatório de Matrículas, agregação por consultora, Dashboard/Relatórios por leitura estática); a autoria do fechamento (`registradoPor*`) aparece como "Fechada por", nunca como crédito. Cobre matrícula antiga confirmada por admin e carteira transferida. |
| `atendimento.ui.test.mjs` | O que cada perfil vê no atendimento compartilhado (ações por etapa, banner, repasse de permissões, conta inativa, titular preservada). |
| `ui.test.mjs` | Tela, Sidebar e bloco de transferência individual: quem vê, seleção origem/destino, prévia e confirmação, nunca declarar sucesso com pendências, histórico e reversão, CSS responsivo, `src/mobile` intacto. |

## Como os testes negativos são escritos (importante)

- `t(nome, "DENY", fn)` só aceita **`permission-denied`** das Rules. Qualquer outro erro
  (instância errada, rede, bug do teste) conta como falha — antes, um teste negativo podia
  "passar" por um erro incidental.
- `tErro(nome, /mensagem/, fn)` é para validações do **serviço** (antes de qualquer gravação):
  exige erro que não seja das Rules e com a mensagem esperada.
- `par(nome, preparar, acao)` roda um **controle** (idêntico, sem o defeito → precisa ser
  aceito) e uma **variante** (só com o defeito → precisa ser negada). Assim a negação só pode
  vir da cláusula testada, e não de outra regra incidental.

## O que as Rules comprovam (e o que não)

Reversão (`rules.test.mjs`, seção I): lead nunca transferido, item original de outra
destinatária/origem, lead movido por outra operação, lead alterado depois (`atualizadoEm`),
etapa mudada, campos além do dono, operação encerrada, usuário não autorizado — cada um
isolado, para origem inativa **e** ativa.

NÃO comprovável nas Rules (continua só no serviço; ver comentário em `firestore.rules`):
eventos da timeline sem gravação no lead (observações/WhatsApp), restauração correta de cada
visita, e a veracidade dos campos de auditoria gravados pelo cliente.

## Importante

- Os UIDs em `helpers.mjs` (`ADM`, `NAY`) são os **UIDs reais do Firebase Authentication**
  e precisam ser iguais aos de `firestore.rules` e `src/config/transferenciaEmMassa.js`.
- As suítes antigas (25 e 46 testes) de consulta de leads e cadastro gerencial não estão
  neste repositório; ao rodá-las contra estas Rules, troque os UIDs `admin1`/`coord1` pelos
  dois UIDs autorizados (senão a troca de dono feita por `coord1` passa a ser negada — é o esperado).

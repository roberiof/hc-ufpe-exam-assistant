# Avaliação das respostas do assistente UDI

Os 32 casos preservam os IDs do documento Golden Truth v0.1 do Linear, atualizado em 28/10/2026. São referências provisórias, não protocolos aprovados. O formulário Word reorganiza as perguntas; sua numeração não deve ser usada como ID sem conferir o conteúdo.

## Executar

Na pasta do repositório, com Node e dependências disponíveis:

```sh
pnpm eval:fallback
```

O comando chama o Route Handler POST diretamente, sem navegador nem servidor, forçando ausência de chave durante a execução. Grava `evaluation/reports/fallback.json` e `fallback.md`. O JSON inclui respostas integrais, fontes retornadas pela API, histórico de entrada, tempos, versão Git e hashes dos dados e arquivos relevantes. Não registra chaves nem conversas de pacientes reais.

Para avaliação com IA, disponibilize CLAUDE_API_KEY no ambiente do terminal e execute `pnpm eval:llm`. A chave não é lida automaticamente de .env.local pelo executor. Chamadas ao modelo podem gerar custo. Perguntas sobre decisões individuais de medicamentos recebem uma resposta determinística antes da IA; o campo responsePath identifica esse caminho como medication-policy. Se a IA cair para fallback por indisponibilidade, a execução falha em vez de apresentar o resultado como LLM. Nenhuma avaliação LLM foi executada no baseline inicial.

Para exigir que todas as verificações passem, use `EVAL_STRICT=1 pnpm eval:fallback`. No modo padrão, falhas do produto são registradas no relatório; o processo falha apenas em erro do executor, resposta inválida ou invariantes do dataset. Um comando verde não significa que os 32 casos passaram.

## Interpretar

As regras em `rules.ts` verificam presença/ausência de trechos, valores e grupos de preparo identificados pelas fontes. Não são avaliadores semânticos: equivalências de linguagem e negativas podem enganar a triagem, e fatos ausentes das regras não são avaliados. Casos sem falhas ainda exigem revisão humana. Medicamentos, variantes e encaminhamentos seguem propostas do documento, ainda pendentes de homologação UDI.

As fontes são as retornadas pela implementação; não representam acesso a documentos oficiais de origem. Os preparos recuperados são inferidos por correspondência exata dos nomes dessas fontes com o catálogo. Código do paciente é verificado nos campos estruturados e no formato explícito de código, sem garantia de detectar siglas soltas.

Antes de alterar dados clínicos, obtenha decisão da UDI por caso com responsável, data e fonte. Preserve o baseline antes de uma nova execução: os relatórios do mesmo modo são sobrescritos. Não transforme conteúdo desconhecido em ausência de preparo.

# Rastreabilidade documental por informação

Este lote corrige a extração não medicamentosa de ultrassom de abdômen total/superior, vias urinárias e pélvica abdominal e Doppler de artérias renais. A fonte é Orientações exames.docx recebido no projeto. A versão é identificada por SHA-256, e cada informação tem trecho, parágrafo, modalidade, identificadores exatos de aplicação e validação UDI pendente. Nenhum original clínico nem registro privado foi incorporado ao repositório.

## Dados e fluxo

- `data/documentary-evidence.json`: fontes e fatos, separando conteúdo, evidência e aplicação. Localização por parágrafos do XML Word, contando parágrafos vazios, não por paginação visual variável.
- `data/preparos.json`: `fact_ids` aponta para os fatos aplicáveis. Grupos corrigidos ficam parciais, sem declarar homologação nem preparo completo.
- `data/exam-preparation-associations.json`: associações explícitas (modalidade:sigla) e justificativa. A ingestão aplica as substituições e recusa referências a exames inexistentes. Não foram criados códigos AGHU.
- `lib/documentary-evidence.ts`: resolve fatos por exame E modalidade. O compositor não herda todos os fatos do grupo: o superior não recebe a bexiga cheia destinada ao total.
- A API inclui `sources[].evidence`, com a informação efetivamente apresentada, fonte, hash, trecho, localização e estado. Pergunta só sobre jejum não atribui à fonte um fato de bexiga que não foi apresentado.
- O chat permite expandir “Informações e trechos de origem”, distinguindo evidência documental de aprovação clínica. Contatos, chegada/documentos gerais e demais itens herdados ainda não têm proveniência integral reconciliada.

A fonte também contém conteúdo medicamentoso e, no Doppler, alimentar, ainda não estruturado neste lote. A resposta declara que é parcial e pede confirmação do preparo completo. Não acrescenta volumes de água, doses ou horários não extraídos. Exames com conjuntos de fatos distintos exigem esclarecimento antes de uma resposta comum.

## Associações restringidas

Somente seis registros US neste lote mantêm associação documental específica: USABT, USABD, USAPU, USGIN, USHOM e USAR. Os onze registros anteriormente herdando orientações abdominais/pélvicas por palavras amplas, mas sem aplicação explícita demonstrada, foram encaminhados a `us_pendente` com status `needs-review`. MAMPC, procedimento em peça cirúrgica, passa a `mamografia_pendente` em vez de receber preparo de paciente. Isso é quarentena técnica por falta de suporte demonstrado, não afirmação de que o procedimento dispensa preparo ou de que a orientação anterior seria clinicamente falsa.

A busca também deixa de introduzir pré-transplante, peça cirúrgica, regulação, complemento e biópsia/punção em perguntas genéricas que não citam esses procedimentos. Pedidos explícitos e códigos continuam encontráveis para comunicar a pendência, sem esconder o exame do catálogo.

## Verificar e reproduzir

```sh
pnpm ingest:check
pnpm audit:evidence
pnpm test
pnpm eval:fallback
```

A conferência opcional do hash do original é local:

```sh
node scripts/verify-documentary-evidence.mjs '/caminho/local/Orientações exames.docx'
```

Não é necessário ter o original no GitHub para executar CI/testes. A verificação de hash prova identidade da versão, não a exatidão clínica. Regerar o catálogo com `pnpm ingest` deve produzir o mesmo resultado, incluindo as associações explícitas.

## Limites

Rastreabilidade por afirmação está implementada somente nos três fatos deste lote. Não presumir cobertura de todos os 21 grupos. Tomografia, RM contrastada, densitometria, protocolos pediátricos, fluxo RX, versões e contatos seguem com as pendências identificadas na auditoria. O restante do conteúdo é marcado como herdado sem proveniência completa; não foi promovido a aprovado. Os 32 casos antigos não passam a ser verdade clínica e não foram modificados para favorecer os resultados.

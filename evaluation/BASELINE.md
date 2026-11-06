# Diagnóstico inicial para o checkpoint de 9 de novembro

Baseline realizado em 5 de novembro de 2026, horário de Recife, sobre o commit 75eabb3fe980d110c6ab593b9b97f1e28c4fba2d do fork Ayrtonguimaraes/hc-ufpe-exam-assistant. Nenhuma lógica de resposta foi alterada nesta etapa.

Foram executados 32 casos provisórios do Linear pela API, forçando fallback. Nove passaram pelas verificações objetivas e 23 ficaram para revisão. Isso não é uma taxa de acurácia clínica. As verificações são incompletas e textuais, e nenhuma referência recebeu aprovação UDI nesta execução. O modelo Claude não foi avaliado.

O retrato preservado está em `baseline-fallback.json` e `baseline-fallback.md`. Execuções futuras atualizam somente `fallback.json` e `fallback.md` na pasta reports. Os arquivos registram as respostas completas, fontes retornadas, verificações, versões e hashes. Os IDs são do Linear; a ordem do Word é diferente.

## Evidências conferidas nas respostas

1. GT-02: pergunta de ultrassom de abdômen total retorna dois exames de ultrassom e uma angiotomografia, com orientações e contatos de modalidades distintas.
2. GT-05: pergunta explicitamente sem contraste inclui uma tomografia com contraste entre as fontes e blocos de resposta.
3. GT-19: pergunta sobre criança inclui o protocolo adulto de uretrocistografia e reproduz Norfloxacino 400 mg; também inclui um raio-X de dedo. A ressalva pediátrica aparece depois da instrução de tomar medicação.
4. GT-21: a resposta contém a antecedência específica de uma hora e depois a orientação geral de 30 minutos. Após dizer que não é necessário jejum, acrescenta que não exige preparo especial, embora liste outras orientações. Inclui ainda exames de outras modalidades.
5. GT-09 e GT-10: o fallback reproduz a instrução geral de não tomar a medicação para diabetes no dia e nas 48 horas seguintes, que o documento de referência exige validar antes de virar orientação individual.
6. GT-24: pergunta genérica de ressonância não resulta no esclarecimento de região esperado e já apresenta tempo de jejum.
7. GT-29: pergunta de contagem não retorna o total corrente de 814 no fallback.

Os preparos de enema adulto e infantil existem em preparos.json, mas nenhum exame do catálogo aponta para esses IDs. Os casos GT-17/18 não devem ser removidos para melhorar o resultado; o vínculo ou o escopo precisa ser investigado com a UDI.

## Prioridades propostas

Para segunda-feira: corrigir a seleção e restrição por modalidade/variante; separar ausência de jejum de ausência de preparo; resolver precedência de orientações específicas; estabelecer encaminhamento para decisões individuais sobre medicamentos segundo critérios acordados. Preservar este baseline e repetir exatamente os mesmos casos após cada conjunto de correções.

Em paralelo, encaminhar os casos provisórios para a UDI confirmar conteúdo e exceções. Não preencher preparos desconhecidos nem aprovar instruções clínicas por inferência. A execução com IA depende de chave disponibilizada no ambiente e deve rejeitar fallback silencioso. Critérios definitivos e homologação permanecem pendentes.

## Verificação do executor

Os dois testes da avaliação passaram, assim como os 22 testes de lógica existentes e TypeScript sem emissão. O executor não usa navegador e não requer servidor. A suíte de interface já havia passado em uma execução anterior; não foi repetida porque esta mudança não altera a interface nem a lógica de produção.

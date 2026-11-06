# Avaliação das correções documentais antes do commit

Data: 06/11/2026. Escopo: três informações não medicamentosas de ultrassom, 18 associações explícitas, metadados de proveniência na API e consulta de trechos na interface. Nenhum documento primário completo nem registro privado foi incluído no repositório. As referências continuam sem homologação UDI.

## Correções e restrições

- USABT: acrescentada informação documental omitida de bexiga cheia, além do jejum já cadastrado; cada informação aponta para seu próprio trecho, parágrafo, versão SHA-256 e aplicação.
- USABD: conserva jejum do trecho de abdômen superior e não herda bexiga cheia do total.
- USAPU/USGIN/USHOM: informação de bexiga cheia restrita ao grupo urinário/pélvico abdominal documentado. USAPU recebe sinônimos explícitos de vias urinárias para impedir que a pergunta genérica seja desviada para procedimento especializado.
- USAR: passa de pendente genérico ao grupo parcial de Doppler de artérias renais, com trecho específico. Orientações adicionais do documento não foram automaticamente publicadas como um protocolo completo.
- Onze registros US com associação abdominal/pélvica não demonstrada passam a pendência explícita; MAMPC deixa de herdar preparo de paciente para procedimento em peça cirúrgica. Não criados códigos nem afirmada dispensa de preparo.
- Busca genérica não introduz procedimentos especiais que o usuário não citou; consultas explícitas continuam identificando a pendência.

## Avaliação executada antes do commit

51 testes de lógica passaram, incluindo oito novos sobre fatos por exame/modalidade, total versus superior, seleção de trechos realmente apresentados, Doppler renal, quarentena, procedimento explícito e sinônimo urinário. TypeScript sem emissão passou.

Oito testes de interface passaram, incluindo expansão do painel de evidências e conferência de parágrafos e aviso de validação pendente. Também foi feita leitura qualitativa pelo app local: total, expansão das duas referências, biópsia renal e Doppler renal. O conteúdo apareceu sem dose automática, sem preparo urinário para biópsia e sem repetição de protocolos. As informações gerais e o aviso de parcialidade tornam a mensagem mais extensa; o painel é opcional.

O script de evidências validou três fatos e 18 associações; SHA-256 do original local conferido. Trechos foram conferidos literalmente no XML original, concatenando runs dentro de cada parágrafo para não introduzir espaços artificiais. A primeira checagem juntava runs com espaços e falhou; corrigido o método de verificação, sem alterar citações para acomodar o erro. A ingestão gerada duas vezes manteve o mesmo hash, com 814 registros e integridade de referências.

Os 32 casos antigos foram reexecutados com regras inalteradas: continuam 23 sem falhas objetivas e nove para revisão. As falhas permanecem GT-04/09/11/13/14/17/18/22/31. Isso não mede a nova exigência de bexiga cheia nem rastreabilidade: os novos testes cobrem essas propriedades. Baseline imediatamente anterior preservado em reports/pre-documentary-fallback.json. Não houve avaliação de Claude.

A primeira execução após quarentena mostrou desvios em vias urinárias e mamografia; em vez de liberar novamente vínculos inseguros, foram corrigidas exclusão de procedimentos especiais não solicitados e busca pelo sinônimo explícito. A suíte voltou ao estado anterior sem mudar gabaritos.

## Cobertura e limites

O total de registros com orientações cadastradas ok/parcial cai de 423 para 412; pendentes sobem de 391 para 402. Doze associações foram retiradas por falta de suporte demonstrado e uma nova informação específica foi ativada (USAR). Isso é correção da cobertura declarada, não perda de uma informação comprovadamente aplicável.

Não há proveniência completa de todos os 21 grupos. As associações documentais são revisão técnica, não aprovação médica. RM contrastada, densitometria, tomografia, pediatria, fluxos RX e contatos seguem com as pendências anteriores. Dados administrativos e textos herdados são identificados como ainda não reconciliados; não foram atribuídos falsamente ao documento de ultrassom.

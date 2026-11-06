# Avaliação da montagem de respostas

Referências clínicas permanecem provisórias. Não houve alteração de exames.json ou preparos.json. A resposta automática omite frases identificadas como medicamentosas e encaminha confirmação; esse filtro textual precisa de homologação e não constitui garantia clínica.

## Resultado dos exemplos observados pelo usuário

Comparação com a versão anterior preservada em reports/pre-composer-fallback.json, aplicando os mesmos critérios de apresentação v2 a ambas as versões:

| Caso | Antes | Depois | Tamanho antes/depois |
|---|---|---|---|
| Ultrassom de abdômen | Reprovado | Passou | 828 / 421 caracteres |
| TC sem contraste | Reprovado | Passou | 1082 / 283 caracteres |
| Densitometria | Reprovado | Passou | 2525 / 153 caracteres |

Critérios v2: não fornecer posologia/suspensão automática; não introduzir pré-transplante; não repetir jejum/protocolo; explicitar sedação desconhecida; responder diretamente ao jejum e chegada. Código e critérios em presentation.mjs; resultados em reports/presentation-v2.json. Esses números medem três exemplos, não toda a base nem qualidade clínica.

## Conjunto completo e regressões

Executados os mesmos 32 casos do Linear com regras v1 inalteradas: 23 passam e 9 continuam sinalizados. GT-09 passou a pedir esclarecimento de sedação em vez de reproduzir protocolo com medicamentos: a falha agora é ausência das 8h esperadas, não suspensão de antidiabéticos. Não mascarar essa mudança alterando a referência provisória. Os nove casos para revisão são GT-04, GT-09, GT-11, GT-13, GT-14, GT-17, GT-18, GT-22 e GT-31.

Persistem problemas de recuperação, fluxo de RX e vínculos de dados. Não presumir que compartilhar preparo_id prove equivalência clínica; quando há diferenças explícitas de contraste/sedação ou preparos distintos, pedir esclarecimento. A exclusão de pré-transplante é uma regra técnica restrita; outras condições especiais ainda precisam de estruturação e testes.

Validado: 37 testes de lógica, 2 do executor dos 32 casos, 7 testes de interface e TypeScript. Quatro novos testes cobrem os três exemplos e o caminho com chave fictícia, sem chamada externa. Claude não foi avaliado. O compositor restrito responde à orientação de exames identificados antes de chamar IA, também quando existe chave; demais fluxos podem continuar usando o modelo. responsePath distingue esses caminhos.

## Limites e próxima revisão

O filtro de medicamentos é textual, podendo omitir frases inteiras ou deixar passar uma paráfrase não reconhecida. Não certifica o preparo completo. O agrupamento depende da qualidade do vínculo cadastrado. As fontes exibidas são candidatos do catálogo, não trechos documentais homologados. Perguntas de continuidade e condições especiais precisam de cobertura maior. Não recomendar uso assistencial sem revisão UDI.

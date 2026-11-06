# Avaliação antes do commit da continuidade

Revisão realizada em 06/11/2026, Recife, antes do commit da implementação de continuidade. Foram usados testes de lógica, execução dos 32 casos da API e leitura direta de uma conversa enviada pela interface local, sem Claude.

## Conversa observada

1. Pergunta: tomografia de tórax sem contraste, qual o jejum? O app declara cadastro pendente e pergunta sobre sedação.
2. Resposta: Sem sedação. O app mantém tomografia e ausência de contraste, recupera o candidato cujo nome usual explicita sem sedação, não repete a pergunta e não inventa jejum.
3. Correção: Na verdade, com contraste. O app passa para o grupo com contraste, sem herdar o qualificador oposto e mantendo a sedação já esclarecida. Continua indicando ausência de protocolo cadastrado.
4. Troca: Agora vou fazer mamografia. Qual o preparo? O app muda de modalidade e responde mamografia, sem aplicar contraste/sedação da tomografia.

Avaliação qualitativa: a continuidade ficou funcional e o app não obriga repetir o nome inteiro do exame. A comunicação de falta de informação continua clara. A saudação não reaparece a cada turno, mas o encerramento e os documentos podem ficar repetitivos em conversas extensas. As fontes de mamografia ainda incluem procedimentos especializados; isso permanece como problema de identificação/seleção de variantes, não resolvido nesta etapa.

## Critérios e evidências

Seis novos testes verificam resolução de esclarecimento, substituição de qualificador, troca de exame, pedido desconhecido/assunto alheio , RM ainda sem região e preservação do esclarecimento em pergunta de documentos. Verificação por candidatos exige atributos do catálogo, não apenas texto de resposta. A busca considera nome principal e nome usual e recusa contradições explícitas entre eles.

43 testes de lógica passaram. Os dois testes do executor dos 32 casos passaram; 23 casos permanecem sem falhas objetivas e nove para revisão. Isso não mede acurácia clínica e não certifica variantes. TypeScript passou. A suíte de sete testes de interface também foi executada antes do commit; seu resultado consta no registro da sessão.

## Limites

Contexto inferido a partir das últimas oito mensagens do usuário, sem estado estruturado persistido. Respostas curtas precisam conter termos reconhecidos; um sim/não isolado ainda não é interpretado como contraste ou sedação. Mudança de região e múltiplos exames na mesma frase precisam de tratamento mais amplo. Não há homologação clínica e não foram alterados os arquivos clínicos.

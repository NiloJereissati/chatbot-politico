# IA educativa com Gemini gratuito — configuração do Render

## Ampliação da compreensão — 14/11/2026

O roteamento anterior só extraía nomes em construções como `Quem é ...`.
`Me diz quem é o Lula` não extraía uma entidade e caía no fallback, antes de
qualquer chamada ao Gemini. O perfil de Lula já existente também não era
elegível para geração. O problema não demonstrava falha do provedor.

`services/politicalLanguage.js` normaliza acentos, caixa, espaços e introduções
conversacionais, extrai nomes completos e aplica o limite de escopo sem usar IA
para classificação. Não faz correspondência parcial de aliases: Lula da Fonte
não vira Luiz Inácio Lula da Silva. O cadastro em `perfisOficiais.js` admite
outros perfis revisados pelo mesmo formato, sem uma resposta especial no router.
Lula e Jair Bolsonaro têm resumos institucionais históricos, fontes próprias e
data de revisão. Esses resumos públicos podem chegar ao Gemini; registros
pessoais brutos das APIs continuam fora do provedor Free.

A base educativa cobre também poderes, Constituição, democracia, partidos e
esquerda/direita, além de PEC, leis e Congresso. Cada tópico seleciona suas
próprias fontes verificadas. Não classifica partidos ou pessoas por ideologia.
Consultas com tipo/número/ano continuam primeiro nas APIs oficiais, incluindo
votações. Não foi criada seção nem integração nova de Projetos de Lei.

Biografias não cobrem todas as figuras políticas: nomes sem perfil revisado
seguem para a consulta parlamentar existente; sem informação suficiente, não
se gera texto nem se anexa uma fonte genérica como prova. Informações atuais
de filiação, ocupação de cargo e situação judicial não são inferidas dos
resumos históricos. Esta melhoria não corrige a abrangência/paginação das
integrações parlamentares legadas nem transforma o serviço em busca universal.
Fora do escopo, propaganda e instruções identificadas recebem orientação sem
consumir Gemini. Os filtros não são garantia completa contra prompt injection.

As fontes adicionais são a Constituição atualizada na Câmara, a explicação do
TSE sobre partido/federação/coligação, o Vocabulário Controlado do Senado e as
referências históricas da Agência Senado, Câmara e MRE listadas diretamente
nos registros. Sínteses são paráfrases, sem notas ou avaliações próprias.

Não há mudanças de variáveis, modelo, quotas, faturamento ou chave. O frontend
continua recebendo `{ reply, intent, sources, mode }`. A correção de formatação
é separada: texto Markdown básico é exibido com elementos React, sem executar
HTML ou transformar URLs geradas em links; fontes mantêm validação própria.

Validação local desta ampliação: `npm ci --ignore-scripts --no-audit --no-fund`,
17 arquivos válidos em `npm run check`, 112 testes em `npm test` (zero falhas)
e auditorias completa/produção com zero vulnerabilidades reportadas. Gemini,
quota e APIs são simulados nos testes. Uma sondagem real anterior à publicação
reproduziu o fallback para `Me diz quem é o Lula.` sem geração. O resultado
remoto de CI/deploy e eventuais respostas reais posteriores são informados no
relatório da tarefa, sem confundi-los com esta validação local.

Esta revisão adapta a implementação existente ao Gemini gratuito. Merge na
`main` foi autorizado; o proprietário confirmou Render → `main` → Auto-Deploy
a cada commit. O merge pode iniciar uma publicação. Ativação e teste com chave
real ainda dependem da configuração privada e de autorização específica.
Não foi ativada cobrança nem usada chave real. O contrato `/chat` continua `{ message }` →
`{ reply, intent, sources, mode }`. Node 22.18 ou superior.

## Diagnóstico do código anterior (histórico OpenAI)

- `dotenv.config()` carregava `.env` automaticamente. Esse arquivo já está
  rastreado no repositório público. Environment vazio no Render **não comprova**
  ausência de configuração: havia outra origem possível. Seus valores não foram
  lidos, copiados para o checkout, registrados ou usados neste trabalho.
- `deveUsarIAControlada` exigia dados e fontes. Templates educativos não tinham
  esses campos; `Fallback` também era excluído. Ativar uma chave não resolvia as
  perguntas abertas. O casamento amplo de “projeto de lei” interceptava comparações.
- A implementação anterior chamava a OpenAI por `/v1/responses`. Sem chave, retornava `null`;
  `AI_ENABLED=false` desativava a etapa. Erros eram capturados, mantendo template.
  Não havia timeout explícito ou orçamento de requisições.
- O estado das variáveis privadas e o commit implantado não foram consultados.
  Não se concluiu que a chave está ausente só pela resposta `template`.

## Integração definitiva desta revisão

- Provedor único: API REST oficial do Gemini, via `generateContent`, sem SDK.
  Não usa compatibilidade OpenAI nem envia payload da Responses API.
- Modelo permitido: **`gemini-3.5-flash-lite`**, estável, entrada e saída
  gratuitas na modalidade Standard da faixa Free segundo a tabela oficial
  consultada em 14/11/2026. Não há troca automática de modelo ou provedor.
  `GEMINI_MODEL` com outro identificador bloqueia a geração, inclusive modelos
  pagos ou aliases legados. O 2.5 Flash-Lite não foi escolhido porque há
  restrições para projetos novos na documentação atual.
- Endpoint fixo:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`.
  Chave somente no header `x-goog-api-key`, nunca na URL. Corpo com
  `systemInstruction`, `contents` e `generationConfig.maxOutputTokens`.
  Somente candidato único com `finishReason: STOP` e texto não vazio é aceito.
  Bloqueios de segurança, respostas parciais e partes de raciocínio não são
  apresentados como resposta gerada. Não habilita tools, busca paga, caching,
  batch, flex ou prioridade. Mantém o raciocínio mínimo padrão do modelo.

- Perguntas educativas abertas sobre PEC, elaboração de leis e Câmara/Senado
  recebem contexto institucional revisado, fontes e uma síntese de base. A
  pergunta original é enviada ao modelo junto com esse contexto. Não há banco,
  busca vetorial, fonte inventada ou novo serviço.
- Consultas específicas a proposições mantêm prioridade. Perguntas sobre dados
  atuais, candidatos, localidades e outras integrações não usam a base educativa.
  Os serviços Câmara, Senado, TSE, IBGE e Transparência não foram modificados.
- IA é opt-in: exige `AI_ENABLED=true`, `GEMINI_FREE_TIER_CONFIRMED=true` e
  `GEMINI_API_KEY` configurada para gerar. A confirmação Free é declaração do
  operador após conferir a conta, não auditoria automática do faturamento.
  Ausência, falha, saída incompleta, contexto excessivo ou orçamento esgotado
  preservam a resposta de base e suas fontes, com `mode: template`.
- Apenas `ExplicarInstituicoes` com contexto `base_educativa_revisada` é enviado
  ao Gemini. Resultados individuais de parlamentares, TSE e demais APIs
  permanecem em resposta de base: não enviamos esses registros pessoais ao
  provedor na faixa gratuita. Email/CPF identificáveis na pergunta também
  bloqueiam o envio; isso não equivale a anonimização completa de texto livre.
- `mode: ai` só acompanha texto completo retornado pelo provedor. Fontes vêm do
  backend. Links gerados fora da lista fornecida são recusados. A revisão e as
  limitações do material educativo são anexadas mesmo se o modelo as omitir.
- O `.env` legado não é carregado. Apenas em `NODE_ENV=development` pode ser
  carregado `.env.local`, que deve permanecer fora do Git. O arquivo de exemplo
  contém chave vazia e IA desativada.
- Logs usam categorias fixas e HTTP status, sem chaves, perguntas ou mensagens
  brutas do provedor. Startup registra se a IA foi explicitamente habilitada.
- O lockfile foi sincronizado com as majors já declaradas: o `npm ci` anterior
  falhava por incompatibilidade entre Express 4/dotenv 16 no manifesto e
  Express 5/dotenv 17 no lockfile. Não foi adicionado SDK nem dependência direta nova.
- Depois da sincronização, o audit identificou quatro pacotes com alertas
  (um crítico e três altos): Axios, follow-redirects, form-data e proxy-addr.
  Foram aplicadas correções compatíveis com as majors declaradas, sem `--force`;
  a auditoria seguinte informou zero vulnerabilidades. Novas dependências
  transitivas dessas versões ficam registradas no lockfile, sem nova dependência
  direta ou mudança de Express 4/dotenv 16.

## Configurações exatas que Nilo deverá conferir

Somente após conferência de gratuidade e autorização para ativação. **Não inserir
chaves no GitHub, no frontend ou em mensagens.** Preencher no painel privado do
serviço backend no Render, não no GitHub Pages.

| Configuração | Valor ou requisito |
| --- | --- |
| Runtime / versão do Node | Node 22.18+, preferencialmente linha 22; `engines` está no manifesto. |
| Build command | `npm ci --ignore-scripts --no-audit --no-fund` |
| Start command | `npm start` |
| `NODE_ENV` | `production` |
| `AI_ENABLED` | `false` por padrão; `true` somente quando a ativação estiver autorizada. |
| `GEMINI_FREE_TIER_CONFIRMED` | `false` por padrão; Nilo define `true` somente depois de verificar projeto Free, sem conta de faturamento vinculada e com quota para o modelo. |
| `GEMINI_API_KEY` | Chave privada criada no Google AI Studio para esse projeto Free; somente no Render. Não enviar por mensagens nem cadastrar no frontend. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (padrão e único identificador aceito). Se não houver acesso gratuito na conta, não substituir por modelo pago. |
| `ALLOWED_ORIGIN` | `https://elias226.github.io` (a origem não inclui `/chat-dashboard-hub/`). Sem configuração mantém `*`, como antes. |
| `AI_TIMEOUT_MS` | Opcional, padrão `20000`; inteiro de `1000` a `45000`, inclui leitura do corpo. |
| `AI_MAX_OUTPUT_TOKENS` | Opcional, padrão `800`; inteiro de `128` a `1500`. Inclui raciocínio e texto. |
| `AI_DAILY_REQUEST_LIMIT` | Opcional, padrão `20`; inteiro de `1` a `100`. Conta também chamadas com erro. |
| `PORT` | Deixar o Render fornecer; fallback local continua 3000. |

As credenciais do Portal da Transparência são independentes e permanecem com
seus nomes existentes (`PORTAL_TRANSPARENCIA_API_KEY` ou `TRANSPARENCIA_API_KEY`).
Não são necessárias para perguntas educativas. Nenhuma credencial real foi usada
nos testes. O frontend já entende `mode: ai` e `mode: template` sem alteração.
As variáveis `OPENAI_*` não são lidas pela integração e não ativam fallback.

## Procedimento privado para Nilo

1. Abrir [Google AI Studio → API keys](https://aistudio.google.com/apikey) na
   própria conta e aceitar os termos somente após lê-los. Criar ou selecionar
   um projeto **Free** sem faturamento vinculado. Não clicar em Set up billing,
   Upgrade, adicionar cartão ou habilitar trial pago.
2. Criar uma chave para esse projeto. A documentação atual usa auth keys por
   padrão, restritas à Gemini API. Conferir associação ao projeto e não usar
   chave de projeto pago. Não reutilizar chaves potencialmente expostas.
3. Na área de [limites ativos](https://aistudio.google.com/rate-limit), conferir
   acesso a `gemini-3.5-flash-lite` e quotas de RPM, TPM e RPD. Os limites variam
   por projeto/modelo/região; não há número gratuito universal garantido. Se o
   projeto precisar de verificação gratuita, concluir só essa verificação.
   Se não houver acesso ou a interface exigir cobrança, parar e manter IA off.
4. Cadastrar privadamente no Render as variáveis da tabela, inicialmente com
   `AI_ENABLED=false`. Manter o serviço na branch `main`. Não modificar o `.env`
   público. Outras credenciais necessárias devem ficar no Environment do Render.
5. Somente depois da conferência e da autorização específica de teste, definir
   `GEMINI_FREE_TIER_CONFIRMED=true` e `AI_ENABLED=true`, salvar/reimplantar.
6. Fazer poucas perguntas educativas e conferir resposta, fontes, data de
   revisão, `mode: ai` e evento sanitizado `generated` no serviço. Conferir o uso
   no projeto Free. HTTP 200 ou teste simulado não comprovam geração real.
7. Para desativar rapidamente, definir `AI_ENABLED=false` no Render e
   salvar/reimplantar. Também retirar a confirmação Free se houver mudança na
   conta. A aplicação continua respondendo com a base e as APIs oficiais.

## Limites e custos

No processo: uma geração simultânea, até cinco inícios por minuto e o orçamento
diário configurado, com reinício da contagem à meia-noite UTC. Limite de mensagem
de 2.000 caracteres, contexto serializado de até 16.000 caracteres e limite de
saída acima. Não há retry automático de geração; nenhum erro amplia o orçamento.

**Contadores em memória não são um teto financeiro garantido.** Reinícios do
Render e múltiplas instâncias reiniciam/multiplicam a contagem. Nilo deve conferir
as quotas da conta do provedor; alertas de orçamento podem não interromper gastos.
Um timeout local também não garante que o provedor deixe de processar a chamada.
O contador local diário usa UTC; o Google reinicia RPD à meia-noite do Pacífico
e compartilha quotas entre chaves do mesmo projeto. Esses limites não são iguais.

Evidências oficiais: [preços do modelo](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite),
[modelo](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite),
[REST generateContent](https://aistudio.google.com/api-reference/generate-content),
[quotas](https://aistudio.google.com/docs/rate-limits),
[chaves](https://aistudio.google.com/docs/api-key) e
[faturamento e tiers](https://aistudio.google.com/docs/billing).

O mesmo modelo também possui preços pagos. Não existe neste endpoint uma flag
de requisição que prove que uma chave pertence a projeto Free. O backend não
consulta Billing nem administra a conta Google. A confirmação do operador
**não garante gratuidade se ele usar uma chave paga ou habilitar cobrança depois**.
Não existe fallback pago; erro de quota/acesso volta à base, sem retry e sem
upgrade. No Free, dados enviados podem ser utilizados para melhoria dos
produtos Google; por isso restringimos o envio ao contexto educativo, sem
histórico nem registros pessoais das APIs. Nunca enviar dados pessoais sensíveis.

## Logs para diagnóstico

Cada tentativa elegível registra `event: ai_result` e uma categoria:

- `disabled`, `free_tier_not_confirmed`, `missing_key`, `invalid_configuration`:
  conferir configuração e conta Free antes de ativar.
- `invalid_key`, `model_unavailable`, `free_tier_or_project_unavailable`,
  `provider_rate_limit`, `provider_access_denied`, `provider_unavailable`,
  `invalid_provider_configuration`: códigos conhecidos retornados pelo Gemini.
- `provider_http_error` + `status`: falha HTTP sem código reconhecido.
- `timeout`, `provider_network_or_parse_error`: conexão/corpo/resposta inválida.
- `incomplete_output`, `safety_blocked`, `safety_or_finish_blocked`,
  `invalid_provider_response`, `empty_or_oversized_output`, `untrusted_output_link`:
  geração recusada, preservando a resposta de base.
- `input_limit`, `context_limit`, `insufficient_grounding`, `busy`, `minute_limit`,
  `daily_limit`, `educational_only`, `personal_data_detected`: bloqueio local,
  sem nova chamada ao provedor.
- `generated`: texto completo aceito; o endpoint retorna `mode: ai`.

Não enviar logs privados integrais contendo dados de outras integrações ou
credenciais. `/health` continua sendo apenas saúde básica, não comprovação de IA.

## Fontes e escopo da base

Paráfrases revisadas em 14/11/2026, sem copiar documentos inteiros. Não informam
tramitação/votação atual, não avaliam partidos e não fazem recomendação eleitoral:

- [Como são feitas as leis — Senado](https://www12.senado.leg.br/jovemsenador/home/paginas/como-sao-feitas-as-leis).
- [Diferenças entre Senado e Câmara — Senado Verifica](https://www12.senado.leg.br/verifica/materias-especiais/2026/qual-a-diferenca-entre-o-senado-e-a-camara-dos-deputados).
- [Manual de Redação da Presidência — processo legislativo, 2018](https://www.gov.br/cvm/pt-br/assuntos/noticias/anexos/2020/20201222_Manual_Redacao_Presidencia.pdf).

Não é uma base jurídica completa. Fatos fora desses tópicos não ganham suporte
apenas porque a pergunta contém uma palavra conhecida; o prompt exige informar
falta de cobertura. Essa instrução e os filtros não garantem correção semântica
nem resistência completa a prompt injection. A qualidade real exige avaliação
após ativação autorizada. Perguntas chegam sem histórico, como no contrato atual.

## Validação e revisão

Com Node 22: `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`,
`npm test`. São verificações de sintaxe e testes unitários/HTTP locais com IA e
APIs simuladas; **não comprovam geração real**. CI da branch/PR usa apenas essas
simulações, sem secrets ou deploy. Checkout parcial exclui `.env` e os
`node_modules` versionados; o lockfile reconstrói as dependências.

Validação local Gemini desta revisão: instalação limpa pelo lockfile,
sintaxe dos 14 arquivos JavaScript, 78 testes aprovados e auditorias completa
e de produção com zero vulnerabilidades reportadas. O processo iniciou sem
credenciais herdadas, com IA desativada e confirmação Free ausente. Respostas
Gemini, falhas e quotas foram simuladas; nenhuma geração real foi testada.
Os resultados remotos ficam nos checks da PR. Não há etapa de deploy no
workflow de testes; o deploy automático do Render é independente.

O repositório já contém `.env` e `node_modules` rastreados. Não foram removidos ou
incluídos no diff desta proposta. Nilo deve verificar privadamente eventual
exposição e revogar segredos comprometidos; `.gitignore` não desfaz histórico.
As dependências instaladas geram diferenças locais em arquivos rastreados, que
ficam visíveis e **não entram no commit**. Nenhum histórico foi reescrito.

Após merge e publicação automática, com projeto Free configurado e uso de chave
explicitamente autorizado,
testar poucas perguntas reais: comparar PEC/PL; explicar aprovação de lei
federal; comparar deputado/senador. Conferir texto, fontes, limitações e
`mode: ai` junto com o registro `generated`/uso no provedor. Não basta HTTP 200.

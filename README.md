# Veletti

Plataforma inicial com assistente de IA, área de estudos, organização de tarefas e educação financeira.

## O que já existe

- Interface responsiva para celular e computador.
- Navegação entre Início, Assistente IA, Estudos, Organização e Finanças.
- Lista de tarefas salva no navegador.
- Registro educativo de entradas e gastos salvo no navegador.
- API de assistente com arquitetura multimodelo: Gemini principal, OpenAI como primeira reserva e Cloudflare como segunda reserva.
- As chaves dos provedores ficam exclusivamente nas variáveis privadas do servidor.
- Rota de saúde em `/health`.

## Executar localmente

1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Configure `GEMINI_API_KEY` no arquivo `.env`. As chaves `OPENAI_API_KEY` e Cloudflare são opcionais e ativam as reservas.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

## Hospedar

Configure o serviço para executar `npm install` durante a instalação e `npm start` no início. Adicione as chaves `GEMINI_API_KEY`, `OPENAI_API_KEY` e, se usar, `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` nas variáveis privadas do serviço de hospedagem. Nunca coloque chaves em arquivos públicos ou no navegador.

## Privacidade e limites da versão inicial

- O assistente envia a mensagem digitada à Gemini API; a integração usa `store: false` para não solicitar armazenamento da interação.
- A modalidade gratuita da API tem limites que podem mudar. Consulte os limites e as condições atuais antes de disponibilizar o chat ao público.
- Na modalidade gratuita, o Google pode usar os dados enviados para melhorar os produtos; não envie dados pessoais, senhas ou informações confidenciais.
- Tarefas e registros financeiros ficam no armazenamento local do navegador deste aparelho; não são sincronizados entre dispositivos.
- Não registre senhas, dados bancários, números de cartão ou outras informações confidenciais.
- A interface é uma primeira versão; ainda não há contas de usuário, sincronização em nuvem ou banco de dados.

## Ordem dos provedores de IA

1. Gemini é a IA principal.
2. OpenAI é acionada quando a principal não consegue responder por indisponibilidade, limite ou erro de servidor.
3. Cloudflare Workers AI é a segunda reserva.
4. Se nenhum provedor estiver configurado ou disponível, a API informa a falha ou usa a demonstração existente, conforme o caso.

O endpoint `/health` informa apenas se cada provedor está configurado; ele não expõe chaves nem testa saldo, créditos ou disponibilidade real.

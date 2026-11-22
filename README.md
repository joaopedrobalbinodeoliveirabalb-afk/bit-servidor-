# Veletti

Plataforma com assistente de IA, área de estudos, organização de tarefas e educação financeira.

## Funcionalidades

- Interface futurista responsiva para celular e computador.
- Assistente com integração principal Gemini e alternativa Cloudflare.
- Pesquisa na web com Brave Search quando a chave estiver configurada.
- Consulta de partidas com API-Football quando configurada.
- Memória recente da conversa no navegador, com opção para limpar o histórico.
- Área de estudos, lista de tarefas e registros educativos de finanças.
- Modo Dono protegido por senha e cookie HttpOnly.
- Painel do proprietário com métricas operacionais da instância atual.
- Rota de saúde em `/health`.

## Executar localmente

1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Configure as integrações que deseja utilizar.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

## Variáveis de ambiente

Configure somente no painel privado do serviço de hospedagem:

- `GEMINI_API_KEY`: chave da API Gemini.
- `GEMINI_MODEL`: modelo Gemini opcional.
- `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`: alternativa de IA.
- `CLOUDFLARE_AI_MODEL`: modelo Cloudflare opcional.
- `BRAVE_SEARCH_API_KEY`: pesquisa na web.
- `FOOTBALL_API_KEY`: dados de futebol.
- `VELETTI_OWNER_PASSWORD`: senha do Modo Dono.
- `VELETTI_SESSION_SECRET`: segredo longo e aleatório para assinar sessões.
- `FRONTEND_URL`: origens permitidas, separadas por vírgula, se o frontend ficar em outro domínio.
- `PORT`: porta fornecida pelo host.

Nunca coloque chaves ou senhas no HTML, no JavaScript do navegador, em commits ou em mensagens.

## Hospedagem

Use `npm install` como comando de instalação e `npm start` como comando de início. Adicione as variáveis privadas acima no painel do Render. Não é necessário mudar o comando de inicialização.

## Memória, métricas e limites

- O histórico recente do chat é salvo no armazenamento local do navegador do usuário. O botão **Limpar conversa** apaga esse histórico daquele navegador.
- O modelo recebe somente uma janela recente da conversa; isso não é memória permanente nem sincronização entre aparelhos.
- Tarefas e registros financeiros permanecem no armazenamento local do navegador.
- As métricas do Modo Dono são mantidas em memória no processo do servidor e reiniciam quando o serviço reinicia ou escala para outra instância.
- O assistente tem limitação de requisições por IP. Limites gratuitos e disponibilidade dos provedores externos podem mudar.
- A API Gemini usa `store: false` nesta integração. Ainda assim, evite enviar dados pessoais, senhas, dados bancários ou informações confidenciais.
- O Veletti não é uma conta bancária nem oferece aconselhamento financeiro personalizado.

## Verificações

Antes de publicar uma alteração, valide a sintaxe do servidor com `node --check server.js`, confira o HTML/JavaScript no navegador e teste:
- `/health`;
- login, logout e métricas do Modo Dono;
- chat com Gemini e fallback Cloudflare;
- pesquisa Brave, quando configurada;
- memória e botão de limpeza do histórico;
- navegação e layout em celular e computador.

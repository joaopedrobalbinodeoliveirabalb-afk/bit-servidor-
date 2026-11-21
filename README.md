# Veletti

Plataforma inicial com assistente de IA, área de estudos, organização de tarefas e educação financeira.

## O que já existe

- Interface responsiva para celular e computador.
- Navegação entre Início, Assistente IA, Estudos, Organização e Finanças.
- Lista de tarefas salva no navegador.
- Registro educativo de entradas e gastos salvo no navegador.
- API de assistente conectada à Gemini API.
- Rota de saúde em `/health`.

## Executar localmente

1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Configure `GEMINI_API_KEY` no arquivo `.env`.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

## Hospedar

Configure o serviço para executar `npm install` durante a instalação e `npm start` no início. Adicione `GEMINI_API_KEY` nas variáveis privadas do serviço de hospedagem, nunca em arquivos públicos ou no navegador.

## Privacidade e limites da versão inicial

- O assistente envia a mensagem digitada à Gemini API; a integração usa `store: false` para não solicitar armazenamento da interação.
- A modalidade gratuita da API tem limites que podem mudar. Consulte os limites e as condições atuais antes de disponibilizar o chat ao público.
- Na modalidade gratuita, o Google pode usar os dados enviados para melhorar os produtos; não envie dados pessoais, senhas ou informações confidenciais.
- Tarefas e registros financeiros ficam no armazenamento local do navegador deste aparelho; não são sincronizados entre dispositivos.
- Não registre senhas, dados bancários, números de cartão ou outras informações confidenciais.
- A interface é uma primeira versão; ainda não há contas de usuário, sincronização em nuvem ou banco de dados.

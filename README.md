# Veletti

Plataforma inicial com assistente de IA, área de estudos, organização de tarefas e educação financeira.

## O que já existe

- Interface responsiva para celular e computador.
- Navegação entre Início, Assistente IA, Estudos, Organização e Finanças.
- Lista de tarefas salva no navegador.
- Registro educativo de entradas e gastos salvo no navegador.
- API de assistente no servidor, com OpenAI e revisão opcional por Anthropic/Claude.
- Rota de saúde em `/health`.

## Executar localmente

1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env`.
4. Se quiser ativar o chat, configure `OPENAI_API_KEY` no arquivo `.env`. A revisão por Claude é opcional e usa `ANTHROPIC_API_KEY`.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

## Hospedar

Configure o serviço para executar `npm install` durante a instalação e `npm start` no início. Adicione as chaves de API nas variáveis privadas do serviço de hospedagem, nunca em arquivos públicos ou no navegador.

## Privacidade e limites da versão inicial

- Tarefas e registros financeiros ficam no armazenamento local do navegador deste aparelho; não são sincronizados entre dispositivos.
- Não registre senhas, dados bancários, números de cartão ou outras informações confidenciais.
- O chat depende de uma chave de API e pode gerar custos conforme o uso e os preços do provedor.
- A interface é uma primeira versão; ainda não há contas de usuário, sincronização em nuvem ou banco de dados.

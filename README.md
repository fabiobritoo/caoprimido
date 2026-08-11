# Cãoprimido 🐶💊

App web (PWA) de controle de medicamentos — cadastro de remédios, lembretes por
notificação push, acompanhamento de saúde e evolução, com dois "modos" de mascote
(Nina e Bob) e várias funcionalidades de apoio. Feito pra ser instalado na tela
inicial do celular (Android e iPhone) e funcionar como um app nativo, mas sem
passar por loja de aplicativos.

**App publicado em:** https://caoprimido.vercel.app
**Repositório:** privado, hospedado no GitHub, deploy automático via Vercel

---

## Stack

- **Frontend:** React + Vite, PWA com Service Worker próprio (`injectManifest`)
- **Hospedagem:** Vercel (deploy automático a cada push na branch `main`)
- **Backend:** Funções serverless da Vercel (`/web/api/`), em ESM
- **Banco:** Upstash Redis (`@vercel/kv`) — guarda inscrições push e estado de notificação
- **Notificações agendadas:** cron-job.org chama `/api/check` a cada minuto
- **Notificações push:** Web Push API (VAPID) + Service Worker
- **Aviso a cuidador:** Telegram Bot API (gratuito, sem limite prático de mensagens)
- **Relatório em PDF:** jsPDF + jspdf-autotable, gerado no navegador (client-side)
- **Armazenamento de dados do usuário:** localStorage (nada vai pra nuvem —
  por isso existe a função de backup/restauração manual)

---

## Funcionalidades

### Remédios
- Cadastro com nome, unidade (comprimido, cápsula, gota, ml, grama, injeção,
  sachê, unidade), dose, horários, frequência (diária / dias específicos da
  semana / a cada X dias), estoque com aviso de quantidade mínima
- Data de início (padrão hoje) e data de término opcional
- Edição e exclusão
- Histórico de preços/compras por remédio (opcional, discreto — ícone de
  etiqueta em "Meus Remédios"), com comparação de variação percentual entre compras

### Tela inicial
- Agenda por dia, navegável por semana (arrasta com o dedo, segue o gesto em
  tempo real) ou pelo ícone de calendário (mês inteiro, dias coloridos por status)
- Doses pendentes agrupadas por horário; doses já tomadas ficam na seção
  "Registrado" com o horário exato da confirmação (editável/desfazível)
- Sequência de dias em dia (streak) e selo no ícone do app com doses pendentes
- Aviso de próxima consulta médica, se houver uma cadastrada

### Notificações
- Push mesmo com o app fechado (funciona no Android normalmente; no iPhone
  precisa estar instalado na tela inicial — limitação da Apple)
- Reenvio escalonado a cada 3 minutos por até 30 min, com mensagens que ficam
  mais urgentes com o tempo, acumulando na central de notificações
- Botões de ação direto na notificação ("Já tomei" / "Adiar 10 min")
- Aviso a um cuidador via Telegram se a dose ficar 15+ min sem confirmar, com
  segunda mensagem de alívio quando finalmente for confirmada

### Evolução (duas abas)
- **Remédios:** % de adesão geral, sequência atual/melhor, mapa de calor das
  últimas 12 semanas (estilo GitHub), adesão individual por remédio
- **Saúde:** peso (com gráfico, período customizável, resumo de variação em
  kg/%), pressão arterial, frequência cardíaca, anotações livres — histórico
  editável por data

### Outros
- Consultas médicas (data, médico, local, anotações)
- Exportação de relatório em PDF (remédios + adesão + saúde + dados pessoais),
  com logo e cores da marca
- Backup/restauração completa dos dados (exporta/importa um `.json`)
- Modo escuro
- **Modo Bob**: troca a mascote e a paleta de cores (rosa → azul) pra quem
  também cuida de outro cachorro no mesmo app
- Verificação de atualização manual (útil quando o Service Worker demora a
  detectar uma versão nova sozinho)

---

## Estrutura do projeto

```
remedios-app/
├── web/                          → PWA (React + Vite) — é isso que está no ar
│   ├── src/
│   │   ├── screens/              → cada tela do app
│   │   ├── components/           → modais e componentes reutilizáveis
│   │   ├── utils/                → lógica de dados, tema, evolução, etc.
│   │   └── sw.js                 → Service Worker (push, notificações, cache)
│   ├── api/                      → funções serverless da Vercel
│   │   ├── check.js              → roda a cada minuto, dispara os lembretes
│   │   ├── subscribe.js          → salva a inscrição push do dispositivo
│   │   ├── reconhecer.js         → marca dose como confirmada
│   │   ├── soneca.js             → adia o lembrete
│   │   ├── status.js             → debug do estado de cada dose
│   │   ├── telegram-*.js         → integração do aviso ao cuidador
│   │   └── _logica.js            → funções compartilhadas entre as rotas
│   └── public/
│       ├── nina/ e bob/          → mascotes de cada modo
│       └── logo-*.png            → logos usadas no relatório PDF
└── assets/                       → cópia das mascotes (referência/backup)
```

*(Existe também uma tentativa inicial em React Native/Expo, hoje abandonada —
o projeto seguiu inteiramente como PWA web.)*

---

## Rodando localmente

```bash
cd web
npm install
npm run build     # gera a pasta dist/
npm run dev       # ambiente de desenvolvimento (Vite)
```

Pra funcionalidades de servidor (notificações, Telegram), é preciso configurar
as variáveis de ambiente na Vercel: chaves VAPID, `CRON_SECRET`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, e a integração do Upstash Redis
(`@vercel/kv`).

## Versão atual

Consulte `web/src/utils/versao.js` — o número e a descrição da última mudança
aparecem também no rodapé da tela inicial do app.

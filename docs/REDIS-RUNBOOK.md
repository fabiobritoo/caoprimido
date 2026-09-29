# Como trocar o Redis (Upstash) quando estourar o limite mensal

Guia pra resolver sozinho, sem precisar do Claude. Nada disso envolve código —
é tudo feito pelo painel da Vercel. O app já está preparado pra funcionar com
qualquer banco Redis novo, desde que as variáveis de ambiente fiquem com o
nome certo.

**Por que isso acontece:** o plano gratuito do Upstash tem um limite de
requisições por mês. Quando estoura, o Redis para de responder e as
notificações (push e aviso ao cuidador) param de funcionar — o resto do app
continua normal, porque os dados dos remédios ficam salvos no celular
(localStorage), não no Redis.

**Como perceber que estourou:** as notificações de horário de remédio param
de chegar, mesmo com o app instalado e as permissões OK.

---

## Passo 1 — Remover a integração antiga

1. Entre em https://vercel.com e abra o projeto **caoprimido**.
2. Vá em **Storage** (menu do projeto).
3. Você vai ver o banco Upstash antigo. Clique nele e procure a opção de
   **Delete** / **Remove** (geralmente nos "..." ou em Settings do banco).
4. Confirme a remoção.

> Isso é necessário porque a conta só permite **um** banco Redis no plano
> gratuito. Enquanto o antigo (cheio) existir, a Vercel não deixa criar
> outro de graça.

## Passo 2 — Criar o banco novo

1. Ainda em **Storage**, clique em **Create Database** (ou **Browse Marketplace**).
2. Escolha **Upstash** → **Redis** (ou "KV" / "Serverless Redis", o nome varia
   um pouco conforme a versão do painel).
3. Selecione o plano **gratuito** (Free / Hobby).
4. Antes de confirmar, vai aparecer um campo de **prefixo das variáveis**
   (às vezes vem preenchido como "STORAGE"). **Apague e coloque `KV`.**
   Esse passo é o mais importante do processo inteiro: o código do app
   (`@vercel/kv`) só funciona se as variáveis se chamarem
   `KV_REST_API_URL` e `KV_REST_API_TOKEN` — com qualquer outro prefixo,
   o app quebra de novo mesmo com o banco criado certinho.
5. Confirme a criação e a conexão com o projeto **caoprimido**.

## Passo 3 — Confirmar que as variáveis ficaram certas

1. Vá em **Settings → Environment Variables** do projeto.
2. Confirme que existem `KV_REST_API_URL` e `KV_REST_API_TOKEN` (e talvez
   `KV_URL`, `KV_REST_API_READ_ONLY_TOKEN` — esses três extras não importam).
3. Se tiver ficado algo como `STORAGE_KV_REST_API_URL` ou outro prefixo
   diferente de `KV_`, volte no Passo 2 e refaça a integração trocando o
   prefixo.

## Passo 4 — Fazer o app pegar as variáveis novas

1. Vá em **Deployments**.
2. No deployment mais recente, clique nos "..." → **Redeploy**.
3. Espere terminar (ícone verde). Isso não muda nenhum código — só reinicia
   o app com as variáveis de ambiente atualizadas.

## Passo 5 — Testar

1. Abra o app no celular.
2. Espere um horário de remédio chegar (ou cadastre um remédio com horário
   daqui a 1-2 minutos, só pra testar).
3. Se a notificação chegar normalmente, deu certo.
4. Se quiser confirmar sem esperar, a tela de **Configurações** ou de
   **Diagnóstico** do app mostra se a conexão com o banco está OK.

---

## Se algo der errado

- **"Não aparece opção de plano gratuito"** → o banco antigo ainda não foi
  removido de verdade (volte no Passo 1) ou já existe outro recurso Upstash
  na conta usando a cota gratuita.
- **Notificação ainda não chega depois do redeploy** → confira de novo o
  Passo 3 (nome das variáveis). É o erro mais comum.
- **O aviso ao cuidador (Telegram) também não chega** → normal, ele depende
  do mesmo Redis pra saber quais doses estão atrasadas. Deve voltar junto
  com o push assim que o Redis novo estiver funcionando.

Isso não precisa de nenhum `git push` nem mudança no repositório — é 100%
configuração dentro da Vercel.

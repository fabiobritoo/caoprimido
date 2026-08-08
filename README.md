# Meus Remédios — App de controle de medicamentos

App em React Native + Expo para cadastrar remédios, receber alarmes nos
horários certos e ser avisado quando o estoque estiver acabando.

## O que já está pronto

- Cadastro de remédio (nome, dosagem, horários, quantidade em estoque)
- Alarme diário repetido por notificação local, para cada horário cadastrado
- Botão "Tomei" que desconta 1 unidade do estoque
- Aviso automático quando o estoque chega na quantidade mínima definida
- Tudo funciona OFFLINE (dados salvos no próprio celular)

## Passo a passo para rodar

### 1. Instale o Node.js (só uma vez)
Baixe em https://nodejs.org (versão LTS). Confirme no terminal:
```
node -v
```

### 2. Instale o Expo CLI e as dependências do projeto
Dentro da pasta do projeto (`remedios-app`), rode:
```
npm install
```

### 3. Instale o app "Expo Go" no seu celular
- Android: procure "Expo Go" na Play Store
- iPhone: procure "Expo Go" na App Store
(Essa é a única instalação manual que você vai precisar fazer — depois
disso, toda atualização do app aparece automaticamente, sem reinstalar nada.)

### 4. Inicie o servidor de desenvolvimento
No terminal, dentro da pasta do projeto:
```
npx expo start
```
Isso abre um QR code no terminal (e também numa página no navegador).

### 5. Abra no celular
- **Android**: abra o app Expo Go e escaneie o QR code
- **iPhone**: abra a câmera do iPhone e aponte pro QR code — vai aparecer
  um aviso pra abrir no Expo Go

O app vai carregar direto no celular. A partir daqui, qualquer alteração
que eu fizer no código atualiza sozinha na tela (hot reload) — você não
precisa reinstalar nada.

### Importante sobre notificações
- No emulador Android, notificações locais funcionam normalmente.
- No Expo Go, alarmes agendados funcionam bem para testes, mas para uso
  "de produção" (app final na loja), o ideal é migrar esse agendamento
  para um build standalone (`expo build` / EAS Build) — isso a gente faz
  mais pra frente, quando o app estiver mais maduro.

## Estrutura do projeto

```
remedios-app/
├── App.js                          → navegação principal
├── app.json                        → configurações do app (nome, ícone, permissões)
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js           → lista de remédios cadastrados
│   │   └── AddMedicineScreen.js    → formulário de cadastro
│   └── utils/
│       ├── storage.js              → salvar/ler remédios no celular
│       └── notifications.js        → agendar alarmes e avisos de estoque
```

## Próximos passos possíveis
- Editar remédio já cadastrado (hoje só dá pra adicionar/excluir)
- Histórico de doses tomadas
- Preparar o build final (EAS Build) para gerar o .apk / enviar pra loja

// Todas as chaves de localStorage que guardam dados do usuário (não inclui
// o ID do dispositivo, que deve continuar sendo único por aparelho)
const CHAVES_BACKUP = [
  '@caoprimido:lista', // remédios cadastrados
  '@caoprimido:registros', // doses tomadas
  '@caoprimido:config', // configurações (cuidador, etc)
  '@caoprimido:saude', // registros de saúde
  '@caoprimido:consultas', // consultas médicas
  '@caoprimido:modoEscuro', // preferência de tema
  '@caoprimido:modoBob', // Nina ou Bob
  '@caoprimido:perfil', // nome, idade, altura
  '@caoprimido:compras', // historico de precos/compras
];

export function exportarBackup() {
  const { blob, nomeArquivo } = montarPacoteBackup();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  registrarBackupFeitoAgora();
}

// Abre o seletor de pastas/local pra salvar nativo do aparelho, deixando a
// pessoa escolher ONDE guardar o arquivo (uma pasta específica, um cartão
// SD, uma pasta sincronizada com nuvem, etc.) em vez de sempre cair na
// pasta padrão de Downloads. Só funciona em navegadores que suportam a
// File System Access API (Chrome/Edge no Android e desktop); no Safari/iOS
// não tem suporte ainda — nesse caso devolve 'sem_suporte' pra tela cair de
// volta pro download comum.
export async function salvarBackupEmLocalEscolhido() {
  if (!window.showSaveFilePicker) return 'sem_suporte';

  const { blob, nomeArquivo } = montarPacoteBackup();

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: nomeArquivo,
      types: [
        {
          description: 'Backup do Cãoprimido',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    registrarBackupFeitoAgora();
    return 'salvo';
  } catch (erro) {
    if (erro.name === 'AbortError') return 'cancelado'; // a pessoa só fechou o seletor
    return 'erro';
  }
}

// Abre o menu de compartilhamento nativo do celular (WhatsApp, e-mail, Drive, etc.)
// com o arquivo de backup já anexado. Devolve false se o aparelho/navegador
// não suportar compartilhar arquivos, pra tela poder cair de volta pro download.
export async function compartilharBackup() {
  const { blob, nomeArquivo } = montarPacoteBackup();
  // 'application/octet-stream' é aceito por mais apps no menu de compartilhar
  // do que 'application/json' (alguns recusam json especificamente)
  const arquivo = new File([blob], nomeArquivo, { type: 'application/octet-stream' });

  if (!navigator.share) return 'sem_suporte';
  if (!navigator.canShare || !navigator.canShare({ files: [arquivo] })) return 'sem_suporte_arquivo';

  try {
    await navigator.share({
      files: [arquivo],
      title: 'Backup do Cãoprimido',
      text: 'Backup dos meus dados do Cãoprimido.',
    });
    return 'compartilhado';
  } catch (erro) {
    if (erro.name === 'AbortError') return 'cancelado'; // usuário só fechou o menu, sem problema
    return 'erro';
  }
}

function montarPacoteBackup() {
  const dados = {};
  for (const chave of CHAVES_BACKUP) {
    const valor = localStorage.getItem(chave);
    if (valor !== null) dados[chave] = valor;
  }

  const pacote = {
    app: 'caoprimido',
    versaoBackup: 1,
    geradoEm: new Date().toISOString(),
    dados,
  };

  const dataArquivo = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
  return { blob, nomeArquivo: `caoprimido-backup-${dataArquivo}.json` };
}

const CHAVE_ULTIMO_BACKUP = '@caoprimido:ultimoBackupEm';
const DIAS_PARA_LEMBRAR = 21;

// Devolve true se já faz tempo suficiente desde o último backup (ou se
// nunca foi feito um) pra valer a pena mostrar um lembrete discreto
export function deveLembrarBackup() {
  const dadosExistem = CHAVES_BACKUP.some((chave) => localStorage.getItem(chave) !== null);
  if (!dadosExistem) return false; // nada cadastrado ainda, sem o que perder

  const ultimoBackupEm = localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  if (!ultimoBackupEm) return true; // nunca fez backup

  const diasDesde = (Date.now() - Number(ultimoBackupEm)) / (1000 * 60 * 60 * 24);
  return diasDesde >= DIAS_PARA_LEMBRAR;
}

function registrarBackupFeitoAgora() {
  localStorage.setItem(CHAVE_ULTIMO_BACKUP, String(Date.now()));
}

// Lê um arquivo de backup (File do input) e devolve os dados pra confirmação,
// sem já sobrescrever nada — a escrita de verdade é feita por aplicarBackup()
export function lerArquivoBackup(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const pacote = JSON.parse(leitor.result);
        if (pacote.app !== 'caoprimido' || !pacote.dados) {
          reject(new Error('Esse arquivo não parece ser um backup válido do Cãoprimido.'));
          return;
        }
        resolve(pacote);
      } catch (e) {
        reject(new Error('Não consegui ler esse arquivo. Confirme que é o backup certo.'));
      }
    };
    leitor.onerror = () => reject(new Error('Falha ao abrir o arquivo.'));
    leitor.readAsText(arquivo);
  });
}

export function aplicarBackup(pacote) {
  for (const chave of CHAVES_BACKUP) {
    if (pacote.dados[chave] !== undefined) {
      localStorage.setItem(chave, pacote.dados[chave]);
    } else {
      // essa chave não existia no momento do backup (ex: nenhuma consulta
      // cadastrada ainda) — restaurar precisa voltar pro estado vazio também,
      // não deixar dados mais novos sobrevivendo por engano
      localStorage.removeItem(chave);
    }
  }
  registrarBackupFeitoAgora();
}

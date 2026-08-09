// Todas as chaves de localStorage que guardam dados do usuário (não inclui
// o ID do dispositivo, que deve continuar sendo único por aparelho)
const CHAVES_BACKUP = [
  '@caoprimido:lista', // remédios cadastrados
  '@caoprimido:registros', // doses tomadas
  '@caoprimido:config', // configurações (cuidador, etc)
  '@caoprimido:saude', // registros de saúde
  '@caoprimido:consultas', // consultas médicas
  '@caoprimido:modoEscuro', // preferência de tema
  '@caoprimido:perfil', // nome, idade, altura
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
}

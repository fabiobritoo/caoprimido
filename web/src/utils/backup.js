// Todas as chaves de localStorage que guardam dados do usuário (não inclui
// o ID do dispositivo, que deve continuar sendo único por aparelho)
const CHAVES_BACKUP = [
  '@caoprimido:lista', // remédios cadastrados
  '@caoprimido:registros', // doses tomadas
  '@caoprimido:config', // configurações (cuidador, etc)
  '@caoprimido:saude', // registros de saúde
  '@caoprimido:consultas', // consultas médicas
  '@caoprimido:modoEscuro', // preferência de tema
];

export function exportarBackup() {
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

  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataArquivo = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `caoprimido-backup-${dataArquivo}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

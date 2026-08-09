// Verifica se existe uma versão nova do app publicada e, se houver,
// ativa ela na hora (sem precisar fechar/abrir o app várias vezes).
//
// Devolve uma string indicando o resultado:
// 'sem_suporte'   -> navegador não suporta service worker
// 'ja_atualizado' -> já está na versão mais recente
// 'atualizando'   -> encontrou uma versão nova e está trocando (a página vai recarregar sozinha)
// 'erro'          -> algo deu errado ao verificar
export function verificarAtualizacao() {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve('sem_suporte');
      return;
    }

    let resolvido = false;
    const finalizar = (resultado) => {
      if (resolvido) return;
      resolvido = true;
      resolve(resultado);
    };

    // se a nova versão assumir o controle, recarrega a página automaticamente
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    navigator.serviceWorker
      .getRegistration()
      .then((registro) => {
        if (!registro) {
          finalizar('erro');
          return;
        }

        // se já tem uma versão esperando (baixada antes mas ainda não ativada),
        // ativa ela direto
        if (registro.waiting) {
          registro.waiting.postMessage({ tipo: 'PULAR_ESPERA' });
          finalizar('atualizando');
          return;
        }

        registro.addEventListener('updatefound', () => {
          const novoWorker = registro.installing;
          if (!novoWorker) return;

          novoWorker.addEventListener('statechange', () => {
            if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // encontrou e já baixou uma versão nova
              novoWorker.postMessage({ tipo: 'PULAR_ESPERA' });
              finalizar('atualizando');
            }
          });
        });

        // força o navegador a checar o servidor por uma versão nova agora
        registro.update().catch(() => finalizar('erro'));

        // se depois de alguns segundos nada novo apareceu, já está atualizado
        setTimeout(() => finalizar('ja_atualizado'), 4000);
      })
      .catch(() => finalizar('erro'));
  });
}

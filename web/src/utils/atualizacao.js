// Verifica se existe uma versão nova do app publicada e, se houver,
// ativa ela na hora (sem precisar fechar/abrir o app várias vezes).
//
// Devolve uma string indicando o resultado:
// 'sem_suporte'   -> navegador não suporta service worker
// 'ja_atualizado' -> já está na versão mais recente
// 'atualizando'   -> encontrou uma versão nova e está trocando (a página vai recarregar sozinha)
// 'erro'          -> algo deu errado ao verificar
import { VERSAO } from './versao.js';

const CHAVE_TENTATIVA = 'caoprimido_tentativa_atualizacao';

function lerTentativa() {
  try {
    return sessionStorage.getItem(CHAVE_TENTATIVA);
  } catch (e) {
    return null;
  }
}

function gravarTentativa(valor) {
  try {
    sessionStorage.setItem(CHAVE_TENTATIVA, valor);
  } catch (e) {
    // sem sessionStorage: segue sem a marcação
  }
}

// Última alternativa: apaga os arquivos guardados (cache do app) e recarrega.
// NÃO remove o Service Worker, então a inscrição de notificações é mantida.
// Usada quando uma tentativa anterior de atualizar recarregou a página e a
// versão continuou a mesma (troca de Service Worker travada).
async function limparCacheERecarregar() {
  try {
    const nomes = await caches.keys();
    await Promise.all(
      nomes.filter((n) => n !== 'caoprimido-pushlog').map((n) => caches.delete(n))
    );
  } catch (e) {
    // segue mesmo assim
  }
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro) await registro.update();
  } catch (e) {
    // segue mesmo assim
  }
  window.location.reload();
}

let recarregando = false;
function recarregar() {
  if (recarregando) return;
  recarregando = true;
  window.location.reload();
}

// Manda o worker novo assumir e garante o reload mesmo se o navegador
// não disparar "controllerchange" (acontece em alguns Androids/WebAPK).
export function aplicarAtualizacao(worker) {
  gravarTentativa(VERSAO);
  navigator.serviceWorker.addEventListener('controllerchange', recarregar);
  worker.addEventListener('statechange', () => {
    if (worker.state === 'activated') setTimeout(recarregar, 300);
  });
  worker.postMessage({ tipo: 'PULAR_ESPERA' });
  setTimeout(recarregar, 3500);
}

// Usada pelo aviso "nova versão disponível": troca normalmente e, se a troca
// já travou antes nesta mesma versão, limpa o cache do app em vez de repetir.
export function atualizarAgora(worker) {
  if (lerTentativa() === VERSAO) {
    gravarTentativa('');
    limparCacheERecarregar();
    return;
  }
  aplicarAtualizacao(worker);
}

// Fica de olho em versões novas do app: avisa assim que existir uma esperando
// (baixada, mas ainda não ativa). Confere ao abrir e sempre que o app volta pra
// frente (no máximo 1x por minuto). Na 1ª instalação (sem versão anterior)
// não avisa. Devolve uma função que cancela a observação.
export function observarNovaVersao(aoEncontrar) {
  if (!('serviceWorker' in navigator)) return () => {};

  let ativo = true;
  let registroAtual = null;
  let ultimaChecagem = Date.now();
  const avisar = (worker) => {
    if (ativo && worker && navigator.serviceWorker.controller) aoEncontrar(worker);
  };

  navigator.serviceWorker
    .getRegistration()
    .then((registro) => {
      if (!registro || !ativo) return;
      registroAtual = registro;

      // já tem uma versão baixada esperando (ex.: da última vez que o app ficou aberto)
      if (registro.waiting) avisar(registro.waiting);

      registro.addEventListener('updatefound', () => {
        const novo = registro.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'installed') avisar(novo);
        });
      });

      registro.update().catch(() => {});
    })
    .catch(() => {});

  const aoVoltarParaOApp = () => {
    if (document.visibilityState !== 'visible' || !registroAtual) return;
    if (Date.now() - ultimaChecagem < 60000) return;
    ultimaChecagem = Date.now();
    registroAtual.update().catch(() => {});
    if (registroAtual.waiting) avisar(registroAtual.waiting);
  };
  document.addEventListener('visibilitychange', aoVoltarParaOApp);

  return () => {
    ativo = false;
    document.removeEventListener('visibilitychange', aoVoltarParaOApp);
  };
}

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

    // A tentativa anterior (nesta mesma versão) já mandou trocar e recarregou,
    // mas continua na mesma versão: a troca normal está travada. Limpa o cache.
    if (lerTentativa() === VERSAO) {
      gravarTentativa('');
      finalizar('atualizando');
      limparCacheERecarregar();
      return;
    }

    const ativar = (worker) => {
      aplicarAtualizacao(worker);
      finalizar('atualizando');
    };

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
          ativar(registro.waiting);
          return;
        }

        registro.addEventListener('updatefound', () => {
          const novoWorker = registro.installing;
          if (!novoWorker) return;

          novoWorker.addEventListener('statechange', () => {
            if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // encontrou e já baixou uma versão nova
              ativar(novoWorker);
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

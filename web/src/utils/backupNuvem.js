// Backup automático CRIPTOGRAFADO, sem login.
//
// Como funciona: cada aparelho tem um "código de recuperação" aleatório (20
// caracteres) que só existe nele e no papel/nota da pessoa. Os dados são
// comprimidos e criptografados (AES-GCM) AQUI no aparelho, com uma chave
// derivada desse código, e só o bloco ilegível vai pro servidor. O endereço
// do backup é um hash do código. Resultado: cada pessoa só alcança o próprio
// backup (precisa do código) e nem o servidor consegue ler o conteúdo.
import { coletarDadosBackup, aplicarBackup } from './backup.js';

const CHAVE_CODIGO = '@caoprimido:codigoRecuperacao';
const CHAVE_ATIVO = '@caoprimido:backupNuvemAtivo';
const CHAVE_EM = '@caoprimido:backupNuvemEm';
const CHAVE_HASH = '@caoprimido:backupNuvemHash';
const CHAVE_ANOTADO = '@caoprimido:codigoAnotado';
const CHAVE_DESLIGADO = '@caoprimido:backupNuvemDesligado'; // a pessoa desligou de propósito

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem letras/números parecidos
const INTERVALO_MINIMO_MS = 30 * 60 * 1000;

const ler = (k) => {
  try { return localStorage.getItem(k); } catch (e) { return null; }
};
const gravar = (k, v) => {
  try { localStorage.setItem(k, v); } catch (e) { /* sem espaço/permissão */ }
};

export function gerarCodigoRecuperacao() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]);
  return letras.join('').replace(/(.{4})(?=.)/g, '$1-');
}

export function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codigoValido(texto) {
  const n = normalizarCodigo(texto);
  return n.length === 20 && [...n].every((c) => ALFABETO.includes(c));
}

export function obterCodigo() {
  return ler(CHAVE_CODIGO);
}
export function backupNuvemAtivo() {
  return ler(CHAVE_ATIVO) === 'true' && !!ler(CHAVE_CODIGO);
}
export function ultimoBackupNuvemEm() {
  const v = Number(ler(CHAVE_EM));
  return v > 0 ? v : null;
}
export function codigoJaAnotado() {
  return ler(CHAVE_ANOTADO) === 'true';
}
export function marcarCodigoAnotado() {
  gravar(CHAVE_ANOTADO, 'true');
}
export function backupNuvemFoiDesligado() {
  return ler(CHAVE_DESLIGADO) === 'true';
}

// ---------- criptografia ----------
const enc = new TextEncoder();

function bytesParaBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64ParaBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(texto) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(texto));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function derivarChave(codigoNormalizado) {
  const material = await crypto.subtle.importKey('raw', enc.encode(codigoNormalizado), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('caoprimido-backup-v1'), iterations: 150000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function comprimir(texto) {
  const fluxo = new Blob([enc.encode(texto)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}
async function descomprimir(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(fluxo).text();
}

async function criptografar(texto, codigoNormalizado) {
  const chave = await derivarChave(codigoNormalizado);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, await comprimir(texto)));
  const tudo = new Uint8Array(iv.length + cifrado.length);
  tudo.set(iv);
  tudo.set(cifrado, iv.length);
  return bytesParaBase64(tudo);
}

async function descriptografar(base64, codigoNormalizado) {
  const tudo = base64ParaBytes(base64);
  const chave = await derivarChave(codigoNormalizado);
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: tudo.slice(0, 12) }, chave, tudo.slice(12));
  return descomprimir(new Uint8Array(claro));
}

async function chamar(acao, id, dados) {
  const resposta = await fetch('/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao, id, dados }),
  });
  return resposta;
}

// ---------- operações ----------

// Liga o backup automático (cria o código se ainda não existe)
export function ativarBackupNuvem() {
  if (!obterCodigo()) gravar(CHAVE_CODIGO, gerarCodigoRecuperacao());
  gravar(CHAVE_ATIVO, 'true');
  gravar(CHAVE_DESLIGADO, 'false');
}

export function desativarBackupNuvem() {
  gravar(CHAVE_ATIVO, 'false');
  gravar(CHAVE_DESLIGADO, 'true');
}

// Envia o backup agora. Com `forcar` falso, só envia se algo mudou desde o
// último envio e já passou um tempinho (evita gastar rede/servidor à toa).
export async function fazerBackupNuvem({ forcar = false } = {}) {
  if (!backupNuvemAtivo()) return { ok: false, motivo: 'desligado' };
  if (!window.crypto?.subtle || typeof CompressionStream === 'undefined') return { ok: false, motivo: 'sem_suporte' };

  const dados = JSON.stringify(coletarDadosBackup());
  const hash = await sha256Hex(dados);
  if (!forcar) {
    if (hash === ler(CHAVE_HASH)) return { ok: true, motivo: 'sem_mudancas' };
    if (Date.now() - (ultimoBackupNuvemEm() || 0) < INTERVALO_MINIMO_MS && ler(CHAVE_HASH)) return { ok: true, motivo: 'aguardando' };
  }

  try {
    const codigo = normalizarCodigo(obterCodigo());
    const pacote = JSON.stringify({ app: 'caoprimido', versaoBackup: 1, geradoEm: new Date().toISOString(), dados: JSON.parse(dados) });
    const bloco = await criptografar(pacote, codigo);
    const resposta = await chamar('salvar', await sha256Hex(`id:${codigo}`), bloco);
    if (!resposta.ok) return { ok: false, motivo: 'servidor' };
    gravar(CHAVE_EM, String(Date.now()));
    gravar(CHAVE_HASH, hash);
    return { ok: true, motivo: 'enviado' };
  } catch (e) {
    return { ok: false, motivo: 'rede' };
  }
}

// Restaura os dados de um backup usando o código de recuperação
export async function restaurarComCodigo(codigoDigitado) {
  if (!codigoValido(codigoDigitado)) return { ok: false, motivo: 'codigo_invalido' };
  const codigo = normalizarCodigo(codigoDigitado);
  try {
    const resposta = await chamar('ler', await sha256Hex(`id:${codigo}`));
    if (resposta.status === 404) return { ok: false, motivo: 'nao_encontrado' };
    if (!resposta.ok) return { ok: false, motivo: 'servidor' };
    const { dados, atualizadoEm } = await resposta.json();
    let texto;
    try {
      texto = await descriptografar(dados, codigo);
    } catch (e) {
      return { ok: false, motivo: 'codigo_invalido' };
    }
    const pacote = JSON.parse(texto);
    aplicarBackup(pacote);
    // passa a usar o mesmo código neste aparelho (continua o mesmo backup)
    gravar(CHAVE_CODIGO, [...codigo].join('').replace(/(.{4})(?=.)/g, '$1-'));
    gravar(CHAVE_ATIVO, 'true');
    gravar(CHAVE_ANOTADO, 'true');
    gravar(CHAVE_EM, String(Date.now()));
    return { ok: true, atualizadoEm };
  } catch (e) {
    return { ok: false, motivo: 'rede' };
  }
}

export async function apagarBackupDoServidor() {
  const codigo = normalizarCodigo(obterCodigo());
  if (!codigo) return false;
  try {
    const r = await chamar('apagar', await sha256Hex(`id:${codigo}`));
    return r.ok;
  } catch (e) {
    return false;
  }
}

// Primeira vez depois da atualização: liga sozinho (a menos que a pessoa já
// tenha desligado) e faz o primeiro envio.
export function iniciarBackupAutomatico() {
  if (!backupNuvemAtivo() && !backupNuvemFoiDesligado()) {
    const temDados = Object.keys(coletarDadosBackup()).length > 0;
    if (temDados) ativarBackupNuvem();
  }
  fazerBackupNuvem();
}

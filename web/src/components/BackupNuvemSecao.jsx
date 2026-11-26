import React, { useState } from 'react';
import { ShieldCheck, Copy, Eye, EyeOff, CloudUpload, KeyRound, Trash2 } from 'lucide-react';
import { useTema } from '../utils/ThemeContext.jsx';
import { RAIO, criarBotaoSecundario } from '../utils/tema.js';
import {
  obterCodigo, backupNuvemAtivo, ultimoBackupNuvemEm, ativarBackupNuvem, desativarBackupNuvem,
  fazerBackupNuvem, restaurarComCodigo, apagarBackupDoServidor, marcarCodigoAnotado, codigoJaAnotado,
} from '../utils/backupNuvem.js';

function quando(ts) {
  if (!ts) return 'ainda não enviado';
  const d = new Date(ts);
  const hoje = new Date();
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hora}`;
}

const MOTIVOS = {
  codigo_invalido: 'Código inválido. Confira os 20 caracteres.',
  nao_encontrado: 'Não encontrei nenhum backup com esse código.',
  servidor: 'O servidor não respondeu direito. Tente de novo.',
  rede: 'Sem conexão agora. Tente de novo.',
  sem_suporte: 'Este navegador não suporta o backup automático.',
};

// Backup automático criptografado (sem login) — fica em Ajustes > Dados e backup
export default function BackupNuvemSecao() {
  const { CORES } = useTema();
  const [, forcar] = useState(0);
  const atualizar = () => forcar((n) => n + 1);
  const [mostrar, setMostrar] = useState(false);
  const [status, setStatus] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const ativo = backupNuvemAtivo();
  const codigo = obterCodigo();
  const botao = { ...criarBotaoSecundario(CORES), width: '100%', marginTop: 10 };
  const texto = { fontSize: 13.5, color: CORES.textoSecundario, lineHeight: 1.45 };

  async function alternar() {
    if (ativo) {
      desativarBackupNuvem();
      setStatus('Backup automático desligado. O que já foi enviado continua guardado (criptografado) até você apagar.');
    } else {
      ativarBackupNuvem();
      setStatus('Ligado. Enviando o primeiro backup...');
      const r = await fazerBackupNuvem({ forcar: true });
      setStatus(r.ok ? 'Backup enviado. Anote o código abaixo!' : MOTIVOS[r.motivo] || 'Não consegui enviar agora.');
    }
    atualizar();
  }

  async function agora() {
    setOcupado(true);
    setStatus('Enviando...');
    const r = await fazerBackupNuvem({ forcar: true });
    setStatus(r.ok ? 'Backup enviado agora.' : MOTIVOS[r.motivo] || 'Não consegui enviar agora.');
    setOcupado(false);
    atualizar();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setStatus('Código copiado.');
    } catch (e) {
      setStatus('Não consegui copiar; anote o código manualmente.');
    }
    marcarCodigoAnotado();
  }

  async function restaurar() {
    if (!confirm('Restaurar vai SUBSTITUIR os dados deste aparelho pelos do backup. Continuar?')) return;
    setOcupado(true);
    setStatus('Restaurando...');
    const r = await restaurarComCodigo(codigoDigitado);
    setOcupado(false);
    if (r.ok) {
      setStatus('Dados restaurados! Recarregando...');
      setTimeout(() => window.location.reload(), 900);
    } else {
      setStatus(MOTIVOS[r.motivo] || 'Não consegui restaurar.');
    }
  }

  async function apagar() {
    if (!confirm('Apagar o backup guardado no servidor? Os dados deste aparelho não são afetados.')) return;
    const ok = await apagarBackupDoServidor();
    desativarBackupNuvem();
    setStatus(ok ? 'Backup apagado do servidor e backup automático desligado.' : 'Não consegui apagar agora. Tente de novo.');
    atualizar();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: CORES.textoPrincipal, marginBottom: 6, marginTop: 12 }}>
        <ShieldCheck size={20} color={CORES.primaria} />
        Backup automático
      </div>
      <div style={{ ...texto, marginBottom: 12 }}>
        Seus dados são criptografados no próprio aparelho antes de irem pro servidor. Só quem tem o seu código de
        recuperação consegue achar e abrir o backup — sem login, sem senha, e cada pessoa só enxerga o próprio.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: CORES.textoPrincipal }}>Enviar backup automaticamente</span>
        <button
          onClick={alternar}
          aria-pressed={ativo}
          style={{ width: 48, height: 28, borderRadius: 14, border: 'none', backgroundColor: ativo ? CORES.primaria : CORES.borda, padding: 3, display: 'flex' }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', transform: ativo ? 'translateX(20px)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>

      {ativo && (
        <>
          <div style={{ ...texto, marginBottom: 10 }}>Último backup: <strong>{quando(ultimoBackupNuvemEm())}</strong></div>

          <div style={{ backgroundColor: CORES.fundo, borderRadius: RAIO.medio, padding: 12, border: `1px solid ${CORES.borda}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: CORES.textoPrincipal }}>
              <KeyRound size={15} /> Seu código de recuperação
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 1, margin: '8px 0', color: CORES.textoPrincipal, wordBreak: 'break-all' }}>
              {mostrar ? codigo : '••••-••••-••••-••••-••••'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMostrar(!mostrar)} style={{ ...botao, marginTop: 0 }}>
                {mostrar ? <EyeOff size={15} /> : <Eye size={15} />} {mostrar ? 'Esconder' : 'Mostrar'}
              </button>
              <button onClick={copiar} style={{ ...botao, marginTop: 0 }}>
                <Copy size={15} /> Copiar
              </button>
            </div>
            <div style={{ ...texto, marginTop: 8, fontSize: 12.5 }}>
              Guarde esse código num lugar seguro (anotação, gerenciador de senhas). Sem ele não dá pra recuperar os
              dados num celular novo — e quem tiver o código acessa o backup.
            </div>
            {!codigoJaAnotado() && (
              <button onClick={() => { marcarCodigoAnotado(); atualizar(); }} style={botao}>Já anotei o código</button>
            )}
          </div>

          <button onClick={agora} disabled={ocupado} style={botao}>
            <CloudUpload size={16} /> Fazer backup agora
          </button>
        </>
      )}

      <div style={{ marginTop: 16, fontWeight: 700, fontSize: 14, color: CORES.textoPrincipal }}>Restaurar com o código</div>
      <div style={{ ...texto, margin: '4px 0 8px' }}>Num celular novo (ou depois de limpar os dados), digite o código pra trazer tudo de volta.</div>
      <input
        value={codigoDigitado}
        onChange={(e) => setCodigoDigitado(e.target.value)}
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: RAIO.medio, border: `1px solid ${CORES.borda}`, backgroundColor: CORES.fundoCard, color: CORES.textoPrincipal, fontFamily: 'monospace', fontSize: 15 }}
      />
      <button onClick={restaurar} disabled={ocupado || !codigoDigitado.trim()} style={botao}>
        Restaurar backup
      </button>

      {codigo && (
        <button onClick={apagar} style={{ ...botao, color: CORES.perigoTexto }}>
          <Trash2 size={15} /> Apagar backup do servidor
        </button>
      )}

      {status && <div style={{ ...texto, marginTop: 10 }}>{status}</div>}
    </div>
  );
}

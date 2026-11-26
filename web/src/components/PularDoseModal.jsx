import React, { useState } from 'react';
import { SkipForward, X } from 'lucide-react';
import { RAIO } from '../utils/tema.js';

const MOTIVOS = ['Passei mal', 'Estava sem o remédio', 'Orientação médica', 'Outro motivo'];

// Folha inferior pra registrar uma dose PULADA de propósito. Diferente de
// esquecer: pular não derruba a adesão nem a sequência, e o motivo fica anotado.
export default function PularDoseModal({ item, CORES, aoFechar, aoConfirmar }) {
  const [motivo, setMotivo] = useState('');
  if (!item) return null;

  return (
    <div style={fundo} onClick={aoFechar}>
      <div style={{ ...folha, backgroundColor: CORES.fundoCard }} onClick={(e) => e.stopPropagation()}>
        <button onClick={aoFechar} style={fechar} aria-label="Fechar">
          <X size={18} color={CORES.textoSecundario} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <SkipForward size={20} color={CORES.primaria} />
          <div style={{ fontSize: 17, fontWeight: 700, color: CORES.textoPrincipal }}>
            Pular {item.remedio.nome} das {item.horario}?
          </div>
        </div>
        <div style={{ fontSize: 13, color: CORES.textoSecundario, marginBottom: 12 }}>
          A dose some dos pendentes, não desconta do estoque e não conta como esquecida.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {MOTIVOS.map((m) => {
            const ativo = motivo === m;
            return (
              <button
                key={m}
                onClick={() => setMotivo(ativo ? '' : m)}
                style={{
                  border: `1.5px solid ${ativo ? CORES.primaria : CORES.borda}`,
                  backgroundColor: ativo ? CORES.primariaClara : 'transparent',
                  color: ativo ? CORES.primariaEscura : CORES.textoPrincipal,
                  borderRadius: RAIO.pill,
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: ativo ? 700 : 500,
                }}
              >
                {m}
              </button>
            );
          })}
        </div>

        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={120}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 12px',
            borderRadius: RAIO.pequeno,
            border: `1.5px solid ${CORES.borda}`,
            backgroundColor: CORES.fundo,
            color: CORES.textoPrincipal,
            fontSize: 15,
            marginBottom: 14,
          }}
        />

        <button
          onClick={() => aoConfirmar(item, motivo)}
          style={{
            width: '100%',
            backgroundColor: CORES.primaria,
            color: '#fff',
            border: 'none',
            borderRadius: RAIO.medio,
            padding: 14,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Pular esta dose
        </button>
      </div>
    </div>
  );
}

const fundo = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', zIndex: 500 };
const folha = { position: 'relative', width: '100%', borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', boxSizing: 'border-box' };
const fechar = { position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', padding: 6 };

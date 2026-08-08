import React, { useState, useEffect, useCallback } from 'react';
import { CORES } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { obterIdDispositivo } from '../utils/storage.js';

export default function DiagnosticoScreen() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const deviceId = obterIdDispositivo();
      const resposta = await fetch(`/api/status?deviceId=${deviceId}`);
      const json = await resposta.json();
      if (!resposta.ok) throw new Error(json.erro || 'Falha ao consultar');
      setDados(json);
    } catch (e) {
      setErro(e.message);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Diagnóstico" mostrarVoltar />

      <div style={{ padding: 16 }}>
        <button onClick={carregar} style={estilos.botaoAtualizar}>
          🔄 Atualizar
        </button>

        {carregando && <div style={estilos.texto}>Carregando...</div>}
        {erro && <div style={{ ...estilos.texto, color: CORES.perigo }}>Erro: {erro}</div>}

        {dados && (
          <>
            <div style={estilos.horaServidor}>
              Hora do servidor agora: <strong>{dados.horaServidor}</strong>
            </div>

            {dados.doses.length === 0 && (
              <div style={estilos.texto}>Nenhuma dose agendada para hoje.</div>
            )}

            {dados.doses.map((d, i) => (
              <div key={i} style={estilos.card}>
                <div style={estilos.nomeHorario}>
                  {d.remedio} · {d.horario}
                </div>
                <div style={estilos.status}>{d.status}</div>
                {d.detalhe && <div style={estilos.detalhe}>{d.detalhe}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const estilos = {
  botaoAtualizar: {
    border: `1px solid ${CORES.primaria}`,
    color: CORES.primaria,
    background: '#fff',
    borderRadius: 8,
    padding: '8px 16px',
    marginBottom: 16,
  },
  texto: { color: CORES.textoSecundario, marginTop: 10 },
  horaServidor: { color: CORES.textoSecundario, marginBottom: 16, fontSize: 14 },
  card: {
    backgroundColor: CORES.fundoCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  nomeHorario: { fontWeight: 700, color: CORES.textoPrincipal },
  status: { color: CORES.primariaEscura, marginTop: 4, fontSize: 14 },
  detalhe: { color: CORES.textoSecundario, marginTop: 2, fontSize: 13 },
};

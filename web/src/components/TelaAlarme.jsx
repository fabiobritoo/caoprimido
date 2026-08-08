import React, { useEffect } from 'react';
import { AlarmClock, Check, Clock3 } from 'lucide-react';
import { CORES, RAIO } from '../utils/tema.js';
import { iniciarAlarme, pararAlarme } from '../utils/somAlarme.js';
import { listarRemedios, alternarDose, doseTomada, obterRegistros, obterIdDispositivo } from '../utils/storage.js';

export default function TelaAlarme({ titulo, corpo, remedioId, dia, horario, aoFechar }) {
  useEffect(() => {
    iniciarAlarme();
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
    }
    return () => pararAlarme();
  }, []);

  async function confirmarETomei() {
    pararAlarme();

    // marca a dose como tomada de verdade (se tivermos os dados pra isso)
    if (remedioId && dia && horario) {
      try {
        const remedios = await listarRemedios();
        const remedio = remedios.find((r) => r.id === remedioId);
        const registros = await obterRegistros();
        const jaMarcado = remedio && doseTomada(registros, remedioId, dia, horario);
        if (remedio && !jaMarcado) {
          await alternarDose(remedio, dia, horario);
        }
      } catch (e) {
        console.error('Erro ao marcar dose como tomada', e);
      }

      // avisa o servidor pra parar de reenviar essa notificação
      try {
        await fetch('/api/reconhecer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: obterIdDispositivo(), remedioId, dia, horario }),
        });
      } catch (e) {
        console.error('Erro ao confirmar com o servidor', e);
      }
    }

    aoFechar();
  }

  async function adiar() {
    pararAlarme();

    if (remedioId && dia && horario) {
      try {
        await fetch('/api/soneca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: obterIdDispositivo(),
            remedioId,
            dia,
            horario,
            minutos: 10,
          }),
        });
      } catch (e) {
        console.error('Erro ao adiar', e);
      }
    }

    aoFechar();
  }

  return (
    <div style={estilos.container}>
      <div style={estilos.iconeAlarme}>
        <AlarmClock size={64} strokeWidth={1.8} color="#fff" />
      </div>
      <div style={estilos.titulo}>{titulo}</div>
      {corpo && <div style={estilos.corpo}>{corpo}</div>}

      <button onClick={confirmarETomei} style={estilos.botaoParar}>
        <Check size={20} strokeWidth={3} />
        Já tomei — Parar alarme
      </button>

      <button onClick={adiar} style={estilos.botaoAdiar}>
        <Clock3 size={16} strokeWidth={2.3} />
        Adiar 10 min
      </button>
    </div>
  );
}

const estilos = {
  container: {
    position: 'fixed',
    inset: 0,
    backgroundColor: CORES.primaria,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    zIndex: 1000,
    textAlign: 'center',
  },
  iconeAlarme: {
    marginBottom: 20,
    animation: 'pulsar 1s infinite',
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 110,
    height: 110,
    borderRadius: RAIO.pill,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 10 },
  corpo: { color: '#fff', fontSize: 16, opacity: 0.9, marginBottom: 40 },
  botaoParar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    color: CORES.primaria,
    border: 'none',
    borderRadius: RAIO.medio,
    padding: '18px 32px',
    fontSize: 18,
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  botaoAdiar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    color: '#fff',
    border: '2px solid rgba(255,255,255,0.6)',
    borderRadius: RAIO.medio,
    padding: '14px 28px',
    fontSize: 15,
    fontWeight: 600,
    marginTop: 14,
  },
};

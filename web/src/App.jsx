import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen.jsx';
import AddMedicineScreen from './screens/AddMedicineScreen.jsx';
import ManageMedicinesScreen from './screens/ManageMedicinesScreen.jsx';
import DiagnosticoScreen from './screens/DiagnosticoScreen.jsx';
import EvolucaoScreen from './screens/EvolucaoScreen.jsx';
import ConsultasScreen from './screens/ConsultasScreen.jsx';
import ConfiguracoesScreen from './screens/ConfiguracoesScreen.jsx';
import TelaAlarme from './components/TelaAlarme.jsx';
import { ProvedorTema } from './utils/ThemeContext.jsx';
import { pedirPermissaoNotificacao, mostrarNotificacao, sincronizarNotificacoesServidor } from './utils/notifications.js';
import { listarRemedios, obterRegistros, doseTomada, alternarDose, obterIdDispositivo } from './utils/storage.js';
import { remedioAplicavelNoDia, formatarData } from './utils/constantes.js';

export default function App() {
  const jaAvisados = useRef(new Set());
  const [alarmeAtivo, setAlarmeAtivo] = useState(null);

  useEffect(() => {
    // Se o app foi aberto a partir do toque numa notificação, mostra a tela de alarme
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get('alarme') === '1') {
      setAlarmeAtivo({
        titulo: parametros.get('titulo') || 'Hora do remédio',
        corpo: parametros.get('corpo') || '',
        remedioId: parametros.get('remedioId') || null,
        dia: parametros.get('dia') || null,
        horario: parametros.get('horario') || null,
      });
      // limpa a URL pra não reabrir o alarme se recarregar a página
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    // Escuta confirmações feitas direto pelo botão "Já tomei" da notificação
    // (o Service Worker avisa o app aberto, se houver algum, pra manter tudo sincronizado)
    if (!('serviceWorker' in navigator)) return;

    async function aoReceberMensagem(evento) {
      if (evento.data?.tipo !== 'DOSE_CONFIRMADA') return;
      const { remedioId, dia, horario } = evento.data;

      const remedios = await listarRemedios();
      const remedio = remedios.find((r) => r.id === remedioId);
      const registros = await obterRegistros();
      if (remedio && !doseTomada(registros, remedioId, dia, horario)) {
        await alternarDose(remedio, dia, horario);
      }

      // se o alarme dessa dose estiver na tela, fecha ele também
      setAlarmeAtivo((atual) =>
        atual && atual.remedioId === remedioId && atual.dia === dia && atual.horario === horario
          ? null
          : atual
      );
    }

    navigator.serviceWorker.addEventListener('message', aoReceberMensagem);
    return () => navigator.serviceWorker.removeEventListener('message', aoReceberMensagem);
  }, []);

  useEffect(() => {
    pedirPermissaoNotificacao();

    (async () => {
      const deviceId = obterIdDispositivo();
      const remedios = await listarRemedios();
      await sincronizarNotificacoesServidor(deviceId, remedios);
    })();

    const verificar = async () => {
      const agora = new Date();
      const hoje = formatarData(agora);
      const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(
        agora.getMinutes()
      ).padStart(2, '0')}`;

      const remedios = await listarRemedios();
      const registros = await obterRegistros();

      for (const remedio of remedios) {
        if (!remedioAplicavelNoDia(remedio.frequencia, hoje)) continue;
        for (const horario of remedio.horarios || []) {
          if (horario !== horaAtual) continue;
          const chave = `${remedio.id}|${hoje}|${horario}`;
          if (jaAvisados.current.has(chave)) continue;
          if (doseTomada(registros, remedio.id, hoje, horario)) continue;

          jaAvisados.current.add(chave);
          mostrarNotificacao(`Hora de tomar: ${remedio.nome}`, remedio.dosagem || '');
          setAlarmeAtivo({
            titulo: `Hora de tomar: ${remedio.nome}`,
            corpo: remedio.dosagem || '',
            remedioId: remedio.id,
            dia: hoje,
            horario,
          });
        }
      }
    };

    const intervalo = setInterval(verificar, 20000);
    verificar();
    return () => clearInterval(intervalo);
  }, []);

  return (
    <ProvedorTema>
      {alarmeAtivo && (
        <TelaAlarme
          titulo={alarmeAtivo.titulo}
          corpo={alarmeAtivo.corpo}
          remedioId={alarmeAtivo.remedioId}
          dia={alarmeAtivo.dia}
          horario={alarmeAtivo.horario}
          aoFechar={() => setAlarmeAtivo(null)}
        />
      )}
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/novo" element={<AddMedicineScreen />} />
          <Route path="/editar/:id" element={<AddMedicineScreen />} />
          <Route path="/meus-remedios" element={<ManageMedicinesScreen />} />
          <Route path="/diagnostico" element={<DiagnosticoScreen />} />
          <Route path="/evolucao" element={<EvolucaoScreen />} />
          <Route path="/consultas" element={<ConsultasScreen />} />
          <Route path="/configuracoes" element={<ConfiguracoesScreen />} />
        </Routes>
      </HashRouter>
    </ProvedorTema>
  );
}

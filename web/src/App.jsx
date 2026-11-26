import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen.jsx';
import AddMedicineScreen from './screens/AddMedicineScreen.jsx';
import ManageMedicinesScreen from './screens/ManageMedicinesScreen.jsx';
import DiagnosticoScreen from './screens/DiagnosticoScreen.jsx';
import SaudeScreen from './screens/SaudeScreen.jsx';
import ComprasRemedioScreen from './screens/ComprasRemedioScreen.jsx';
import ComoInstalarScreen from './screens/ComoInstalarScreen.jsx';
import ConfiguracoesScreen from './screens/ConfiguracoesScreen.jsx';
import TelaAlarme from './components/TelaAlarme.jsx';
import AvisoAtualizacao from './components/AvisoAtualizacao.jsx';
import { ProvedorTema } from './utils/ThemeContext.jsx';
import { iniciarBackupAutomatico, fazerBackupNuvem } from './utils/backupNuvem.js';
import { pedirPermissaoNotificacao, mostrarNotificacao, sincronizarNotificacoesServidor } from './utils/notifications.js';
import { listarRemedios, obterRegistros, doseTomada, alternarDose, obterIdDispositivo } from './utils/storage.js';
import { remedioAplicavelNoDia, remedioNoDia, formatarData, descreverDose, doseValeNoDia } from './utils/constantes.js';

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
    // backup automático criptografado: ao abrir e sempre que o app volta pra frente
    iniciarBackupAutomatico();
    // ao sair do app também envia (se algo mudou), pra o backup ficar em dia
    const aoVoltar = () => fazerBackupNuvem();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
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

      for (const remedioBase of remedios) {
        // com fases de dose, o texto do alarme usa a dose que vale hoje
        const remedio = remedioNoDia(remedioBase, hoje);
        if (!remedioAplicavelNoDia(remedio.frequencia, hoje, remedio.dataInicio, remedio.dataTermino)) continue;
        for (const horario of remedio.horarios || []) {
          if (horario !== horaAtual) continue;
          if (!doseValeNoDia(remedio, hoje, horario)) continue;
          const chave = `${remedio.id}|${hoje}|${horario}`;
          if (jaAvisados.current.has(chave)) continue;
          if (doseTomada(registros, remedio.id, hoje, horario)) continue;

          jaAvisados.current.add(chave);
          mostrarNotificacao(`Hora de tomar: ${remedio.nome}`, descreverDose(remedio));
          setAlarmeAtivo({
            titulo: `Hora de tomar: ${remedio.nome}`,
            corpo: descreverDose(remedio),
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
      <AvisoAtualizacao />
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/novo" element={<AddMedicineScreen />} />
          <Route path="/editar/:id" element={<AddMedicineScreen />} />
          <Route path="/meus-remedios" element={<ManageMedicinesScreen />} />
          <Route path="/diagnostico" element={<DiagnosticoScreen />} />
          <Route path="/saude" element={<SaudeScreen />} />
          {/* endereços antigos continuam funcionando */}
          <Route path="/evolucao" element={<Navigate to="/saude?aba=adesao" replace />} />
          <Route path="/consultas" element={<Navigate to="/saude?aba=consultas" replace />} />
          <Route path="/remedio/:id/compras" element={<ComprasRemedioScreen />} />
          <Route path="/como-instalar" element={<ComoInstalarScreen />} />
          <Route path="/configuracoes" element={<ConfiguracoesScreen />} />
        </Routes>
      </HashRouter>
    </ProvedorTema>
  );
}

import React, { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen.jsx';
import AddMedicineScreen from './screens/AddMedicineScreen.jsx';
import ManageMedicinesScreen from './screens/ManageMedicinesScreen.jsx';
import { pedirPermissaoNotificacao, mostrarNotificacao, sincronizarNotificacoesServidor } from './utils/notifications.js';
import { listarRemedios, obterRegistros, doseTomada, obterIdDispositivo } from './utils/storage.js';
import { remedioAplicavelNoDia, formatarData } from './utils/constantes.js';

export default function App() {
  const jaAvisados = useRef(new Set());

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
        }
      }
    };

    const intervalo = setInterval(verificar, 20000);
    verificar();
    return () => clearInterval(intervalo);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/novo" element={<AddMedicineScreen />} />
        <Route path="/editar/:id" element={<AddMedicineScreen />} />
        <Route path="/meus-remedios" element={<ManageMedicinesScreen />} />
      </Routes>
    </HashRouter>
  );
}

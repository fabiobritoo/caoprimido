import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  listarRemedios,
  salvarRemedios,
  obterRegistros,
  doseTomada,
  alternarDose,
} from '../utils/storage';
import { avisarEstoqueBaixo, reagendarAlarmesIntervalo } from '../utils/notifications';
import {
  rotuloUnidade,
  diasDaSemanaAtualSegunda,
  remedioAplicavelNoDia,
  formatarData,
} from '../utils/constantes';

const HOJE = formatarData(new Date());

export default function HomeScreen({ navigation }) {
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);

  const diasDaSemana = diasDaSemanaAtualSegunda();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('GerenciarRemedios')}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: '#4A90D9', fontWeight: '600' }}>Meus remédios</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const carregar = useCallback(async () => {
    let lista = await listarRemedios();
    lista = await reagendarAlarmesIntervalo(lista, salvarRemedios);
    const regs = await obterRegistros();
    setRemedios(lista);
    setRegistros(regs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  // Monta a lista de "doses" (remédio + horário) agendadas para o dia selecionado
  const dosesDoDia = [];
  for (const remedio of remedios) {
    if (!remedioAplicavelNoDia(remedio.frequencia, diaSelecionado)) continue;
    for (const horario of remedio.horarios || []) {
      dosesDoDia.push({
        remedio,
        horario,
        tomado: doseTomada(registros, remedio.id, diaSelecionado, horario),
      });
    }
  }
  dosesDoDia.sort((a, b) => a.horario.localeCompare(b.horario));

  const diaEhFuturo = diaSelecionado > HOJE;

  async function alternarDoseItem(item) {
    if (diaEhFuturo) return;

    const resultado = await alternarDose(item.remedio, diaSelecionado, item.horario);
    setRemedios(resultado.remedios);
    setRegistros(resultado.registros);

    if (resultado.tomadoAgora) {
      const atualizado = resultado.remedios.find((r) => r.id === item.remedio.id);
      if (atualizado && atualizado.quantidadeAtual <= atualizado.quantidadeMinima) {
        await avisarEstoqueBaixo(
          atualizado.nome,
          atualizado.quantidadeAtual,
          rotuloUnidade(atualizado.unidade).toLowerCase()
        );
      }
    }
  }

  function renderDoseItem({ item }) {
    const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
    const atrasado = !item.tomado && diaSelecionado < HOJE;

    return (
      <TouchableOpacity
        style={[
          styles.doseCard,
          item.tomado && styles.doseCardTomado,
          atrasado && styles.doseCardAtrasado,
        ]}
        onPress={() => alternarDoseItem(item)}
        disabled={diaEhFuturo}
      >
        <View style={styles.doseHorarioBloco}>
          <Text style={styles.doseHorario}>{item.horario}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doseNome}>{item.remedio.nome}</Text>
          <Text style={styles.doseDetalhe}>
            {item.remedio.quantidadePorDose} {unidadeTexto}
          </Text>
        </View>
        <View
          style={[
            styles.doseStatus,
            item.tomado && styles.doseStatusTomado,
            atrasado && styles.doseStatusAtrasado,
          ]}
        >
          <Text style={styles.doseStatusTexto}>{item.tomado ? '✓' : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.faixaSemana}>
        {diasDaSemana.map((dia) => {
          const selecionado = dia.data === diaSelecionado;
          const hoje = dia.data === HOJE;
          return (
            <TouchableOpacity
              key={dia.data}
              style={styles.diaColuna}
              onPress={() => setDiaSelecionado(dia.data)}
            >
              <Text style={styles.diaAbrev}>{dia.abrev}</Text>
              <View
                style={[
                  styles.diaCirculo,
                  selecionado && styles.diaCirculoSelecionado,
                  !selecionado && hoje && styles.diaCirculoHoje,
                ]}
              >
                <Text
                  style={[
                    styles.diaNumero,
                    selecionado && styles.diaNumeroSelecionado,
                  ]}
                >
                  {dia.numero}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={dosesDoDia}
        keyExtractor={(item) => `${item.remedio.id}-${item.horario}`}
        renderItem={renderDoseItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Text style={styles.vazioEmoji}>💊</Text>
            <Text style={styles.vazioTexto}>
              Nenhum remédio agendado para esse dia.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.botaoAdicionar}
        onPress={() => navigation.navigate('AdicionarRemedio')}
      >
        <Text style={styles.botaoAdicionarTexto}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  faixaSemana: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  diaColuna: { alignItems: 'center', width: 40 },
  diaAbrev: { fontSize: 11, color: '#888', marginBottom: 6 },
  diaCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaCirculoSelecionado: { backgroundColor: '#4A90D9' },
  diaCirculoHoje: { borderWidth: 2, borderColor: '#4A90D9' },
  diaNumero: { fontSize: 15, fontWeight: '600', color: '#333' },
  diaNumeroSelecionado: { color: '#fff' },
  doseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  doseCardTomado: { backgroundColor: '#EAF7EC' },
  doseCardAtrasado: { backgroundColor: '#FDECEC' },
  doseHorarioBloco: {
    width: 56,
    alignItems: 'center',
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#EEE',
    paddingRight: 12,
  },
  doseHorario: { fontSize: 15, fontWeight: '700', color: '#4A90D9' },
  doseNome: { fontSize: 16, fontWeight: '600' },
  doseDetalhe: { color: '#777', fontSize: 13, marginTop: 2 },
  doseStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doseStatusTomado: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  doseStatusAtrasado: { borderColor: '#D9534F' },
  doseStatusTexto: { color: '#fff', fontWeight: '700' },
  vazioContainer: { alignItems: 'center', marginTop: 60 },
  vazioEmoji: { fontSize: 40, marginBottom: 12 },
  vazioTexto: { color: '#999', textAlign: 'center' },
  botaoAdicionar: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#4A90D9',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  botaoAdicionarTexto: { color: '#fff', fontSize: 30, marginTop: -2 },
});

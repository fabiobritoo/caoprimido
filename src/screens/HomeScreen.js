import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Image,
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
import { CORES } from '../utils/tema';

const HOJE = formatarData(new Date());

const MASCOTE_HORA_REMEDIO = require('../../assets/nina/mascote-hora-remedio.png');
const MASCOTE_DORMINDO = require('../../assets/nina/mascote-dormindo.png');
const MASCOTE_PARABENS = require('../../assets/nina/mascote-parabens.png');
const NINA_LAMBENDO_GIF = require('../../assets/nina/nina-lambendo.gif');

export default function HomeScreen({ navigation }) {
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);

  const diasDaSemana = diasDaSemanaAtualSegunda();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: CORES.primaria },
      headerTintColor: '#fff',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('GerenciarRemedios')}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Meus remédios</Text>
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
  const todasTomadas = dosesDoDia.length > 0 && dosesDoDia.every((d) => d.tomado);

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
        ListHeaderComponent={
          dosesDoDia.length > 0 ? (
            <View style={styles.cabecalhoLista}>
              <Image
                source={todasTomadas ? MASCOTE_PARABENS : MASCOTE_HORA_REMEDIO}
                style={styles.mascoteCabecalho}
                resizeMode="contain"
              />
              {todasTomadas && (
                <Text style={styles.textoParabens}>Tudo em dia por hoje! 🎉</Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Image
              source={MASCOTE_DORMINDO}
              style={styles.mascoteVazio}
              resizeMode="contain"
            />
            <Text style={styles.vazioTexto}>
              Nenhum remédio agendado para esse dia.
            </Text>
          </View>
        }
      />

      {todasTomadas && (
        <View style={styles.gifCantoContainer} pointerEvents="none">
          <Image source={NINA_LAMBENDO_GIF} style={styles.gifCanto} />
        </View>
      )}

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
  container: { flex: 1, backgroundColor: CORES.fundo },
  faixaSemana: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: CORES.fundoCard,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
  },
  diaColuna: { alignItems: 'center', width: 40 },
  diaAbrev: { fontSize: 11, color: CORES.textoSecundario, marginBottom: 6 },
  diaCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaCirculoSelecionado: { backgroundColor: CORES.primaria },
  diaCirculoHoje: { borderWidth: 2, borderColor: CORES.primaria },
  diaNumero: { fontSize: 15, fontWeight: '600', color: CORES.textoPrincipal },
  diaNumeroSelecionado: { color: '#fff' },
  cabecalhoLista: { alignItems: 'center', marginBottom: 12 },
  mascoteCabecalho: { width: 130, height: 130 },
  textoParabens: {
    fontSize: 16,
    fontWeight: '700',
    color: CORES.primariaEscura,
    marginTop: -6,
  },
  doseCard: {
    backgroundColor: CORES.fundoCard,
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
  doseCardTomado: { backgroundColor: '#EDF7EE' },
  doseCardAtrasado: { backgroundColor: '#FBEAEA' },
  doseHorarioBloco: {
    width: 56,
    alignItems: 'center',
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: CORES.borda,
    paddingRight: 12,
  },
  doseHorario: { fontSize: 15, fontWeight: '700', color: CORES.primaria },
  doseNome: { fontSize: 16, fontWeight: '600', color: CORES.textoPrincipal },
  doseDetalhe: { color: CORES.textoSecundario, fontSize: 13, marginTop: 2 },
  doseStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doseStatusTomado: { backgroundColor: CORES.sucesso, borderColor: CORES.sucesso },
  doseStatusAtrasado: { borderColor: CORES.perigo },
  doseStatusTexto: { color: '#fff', fontWeight: '700' },
  vazioContainer: { alignItems: 'center', marginTop: 30 },
  mascoteVazio: { width: 220, height: 220, marginBottom: 12 },
  vazioTexto: { color: CORES.textoSecundario, textAlign: 'center' },
  gifCantoContainer: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  gifCanto: { width: '100%', height: '100%' },
  botaoAdicionar: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: CORES.primaria,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  botaoAdicionarTexto: { color: '#fff', fontSize: 30, marginTop: -2 },
});

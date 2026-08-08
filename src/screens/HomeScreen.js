import React, { useState, useCallback } from 'react';
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
  removerRemedio,
  salvarRemedios,
  obterRegistros,
  doseTomadaNoDia,
  alternarDoseDoDia,
} from '../utils/storage';
import {
  avisarEstoqueBaixo,
  cancelarAlarmes,
  reagendarAlarmesIntervalo,
} from '../utils/notifications';
import {
  rotuloUnidade,
  descreverFrequencia,
  diasDaSemanaAtual,
  remedioAplicavelNoDia,
  formatarData,
} from '../utils/constantes';

const DIAS_SEMANA_ATUAL = diasDaSemanaAtual();
const HOJE = formatarData(new Date());

export default function HomeScreen({ navigation }) {
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});

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

  async function alternarDia(remedio, dataStr) {
    const passado = dataStr > HOJE;
    if (passado) return; // não deixa marcar dias futuros

    const resultado = await alternarDoseDoDia(remedio, dataStr);
    setRemedios(resultado.remedios);
    setRegistros(resultado.registros);

    if (resultado.tomadoAgora) {
      const atualizado = resultado.remedios.find((r) => r.id === remedio.id);
      if (atualizado && atualizado.quantidadeAtual <= atualizado.quantidadeMinima) {
        await avisarEstoqueBaixo(
          atualizado.nome,
          atualizado.quantidadeAtual,
          rotuloUnidade(atualizado.unidade).toLowerCase()
        );
      }
    }
  }

  async function excluir(remedio) {
    await cancelarAlarmes(remedio.notificationIds);
    const novaLista = await removerRemedio(remedio.id);
    setRemedios(novaLista);
  }

  function editar(remedio) {
    navigation.navigate('AdicionarRemedio', { remedioId: remedio.id });
  }

  function corDoDia(remedio, diaInfo) {
    const aplicavel = remedioAplicavelNoDia(remedio.frequencia, diaInfo.data);
    if (!aplicavel) return 'naoAplicavel';
    if (diaInfo.data > HOJE) return 'futuro';

    const tomado = doseTomadaNoDia(registros, remedio.id, diaInfo.data);
    if (tomado) return 'tomado';
    if (diaInfo.data === HOJE) return 'hoje';
    return 'atrasado';
  }

  function renderItem({ item }) {
    const estoqueBaixo = item.quantidadeAtual <= item.quantidadeMinima;
    const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
    const quantidadePorDose = item.quantidadePorDose || 1;
    const horarios = item.horarios || [];

    return (
      <View style={styles.card}>
        <View style={styles.cabecalho}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{item.nome}</Text>
            <Text style={styles.detalhe}>
              {quantidadePorDose} {unidadeTexto} · {horarios.join(', ')}
            </Text>
            <Text style={styles.detalhe}>{descreverFrequencia(item.frequencia)}</Text>
          </View>
          <View style={styles.acoes}>
            <TouchableOpacity onPress={() => editar(item)}>
              <Text style={styles.editar}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => excluir(item)}>
              <Text style={styles.excluir}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.semana}>
          {DIAS_SEMANA_ATUAL.map((diaInfo) => {
            const status = corDoDia(item, diaInfo);
            const estilos = {
              tomado: styles.diaTomado,
              hoje: styles.diaHoje,
              atrasado: styles.diaAtrasado,
              futuro: styles.diaFuturo,
              naoAplicavel: styles.diaNaoAplicavel,
            };
            const textoStyles = {
              tomado: styles.diaTextoClaro,
              hoje: styles.diaTextoEscuro,
              atrasado: styles.diaTextoClaro,
              futuro: styles.diaTextoApagado,
              naoAplicavel: styles.diaTextoApagado,
            };
            const podeToccar = status === 'tomado' || status === 'hoje' || status === 'atrasado';

            return (
              <TouchableOpacity
                key={diaInfo.data}
                disabled={!podeToccar}
                onPress={() => alternarDia(item, diaInfo.data)}
                style={[styles.diaCelula, estilos[status]]}
              >
                <Text style={[styles.diaCelulaLetra, textoStyles[status]]}>
                  {diaInfo.curto}
                </Text>
                <Text style={[styles.diaCelulaNumero, textoStyles[status]]}>
                  {status === 'tomado' ? '✓' : diaInfo.numero}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.estoque, estoqueBaixo && styles.estoqueBaixo]}>
          Estoque: {item.quantidadeAtual} {unidadeTexto}
          {estoqueBaixo ? ' ⚠️ comprar mais' : ''}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Cãoprimido</Text>

      <FlatList
        data={remedios}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            Nenhum remédio cadastrado ainda. Toque em "+" para adicionar.
          </Text>
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
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start' },
  nome: { fontSize: 18, fontWeight: '600' },
  detalhe: { color: '#666', marginTop: 2, fontSize: 13 },
  acoes: { alignItems: 'flex-end' },
  editar: { color: '#4A90D9', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  excluir: { color: '#D9534F', fontSize: 12 },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  diaCelula: {
    width: 38,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaCelulaLetra: { fontSize: 10, fontWeight: '600' },
  diaCelulaNumero: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  diaTomado: { backgroundColor: '#4CAF50' },
  diaHoje: { backgroundColor: '#FFD166', borderWidth: 2, borderColor: '#F5A623' },
  diaAtrasado: { backgroundColor: '#F2A0A0' },
  diaFuturo: { backgroundColor: '#F0F0F0' },
  diaNaoAplicavel: { backgroundColor: 'transparent' },
  diaTextoClaro: { color: '#fff' },
  diaTextoEscuro: { color: '#7A4A00' },
  diaTextoApagado: { color: '#BBB' },
  estoque: { marginTop: 12, fontWeight: '500' },
  estoqueBaixo: { color: '#D9534F' },
  vazio: { textAlign: 'center', marginTop: 40, color: '#999' },
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

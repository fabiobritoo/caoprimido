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
  registrarDoseTomada,
  removerRemedio,
  salvarRemedios,
} from '../utils/storage';
import {
  avisarEstoqueBaixo,
  cancelarAlarmes,
  reagendarAlarmesIntervalo,
} from '../utils/notifications';
import { rotuloUnidade, descreverFrequencia } from '../utils/constantes';

export default function HomeScreen({ navigation }) {
  const [remedios, setRemedios] = useState([]);

  const carregar = useCallback(async () => {
    let lista = await listarRemedios();
    // Reagenda automaticamente os remédios de "intervalo de dias"
    // cuja próxima dose já passou da data.
    lista = await reagendarAlarmesIntervalo(lista, salvarRemedios);
    setRemedios(lista);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function marcarComoTomado(remedio) {
    const novaLista = await registrarDoseTomada(remedio.id);
    setRemedios(novaLista);

    const atualizado = novaLista.find((r) => r.id === remedio.id);
    if (
      atualizado &&
      atualizado.quantidadeAtual <= atualizado.quantidadeMinima
    ) {
      await avisarEstoqueBaixo(
        atualizado.nome,
        atualizado.quantidadeAtual,
        rotuloUnidade(atualizado.unidade).toLowerCase()
      );
    }
  }

  async function excluir(remedio) {
    await cancelarAlarmes(remedio.notificationIds);
    const novaLista = await removerRemedio(remedio.id);
    setRemedios(novaLista);
  }

  function renderItem({ item }) {
    const estoqueBaixo = item.quantidadeAtual <= item.quantidadeMinima;
    const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
    const quantidadePorDose = item.quantidadePorDose || 1;
    const horarios = item.horarios || [];

    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nome}>{item.nome}</Text>
          <Text style={styles.detalhe}>
            {quantidadePorDose} {unidadeTexto} por dose
          </Text>
          <Text style={styles.detalhe}>
            Horários: {horarios.join(', ')}
          </Text>
          <Text style={styles.detalhe}>{descreverFrequencia(item.frequencia)}</Text>
          <Text style={[styles.estoque, estoqueBaixo && styles.estoqueBaixo]}>
            Estoque: {item.quantidadeAtual} {unidadeTexto}
            {estoqueBaixo ? ' ⚠️ comprar mais' : ''}
          </Text>
        </View>

        <View style={styles.acoes}>
          <TouchableOpacity
            style={styles.botaoTomei}
            onPress={() => marcarComoTomado(item)}
          >
            <Text style={styles.botaoTexto}>Tomei</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => excluir(item)}>
            <Text style={styles.excluir}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Meus Remédios</Text>

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
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nome: { fontSize: 18, fontWeight: '600' },
  detalhe: { color: '#666', marginTop: 2 },
  estoque: { marginTop: 6, fontWeight: '500' },
  estoqueBaixo: { color: '#D9534F' },
  acoes: { alignItems: 'flex-end' },
  botaoTomei: {
    backgroundColor: '#4A90D9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  botaoTexto: { color: '#fff', fontWeight: '600' },
  excluir: { color: '#D9534F', fontSize: 12 },
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

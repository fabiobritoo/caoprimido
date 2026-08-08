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
import { listarRemedios, removerRemedio } from '../utils/storage';
import { cancelarAlarmes } from '../utils/notifications';
import { rotuloUnidade, descreverFrequencia } from '../utils/constantes';

export default function ManageMedicinesScreen({ navigation }) {
  const [remedios, setRemedios] = useState([]);

  const carregar = useCallback(async () => {
    const lista = await listarRemedios();
    setRemedios(lista);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function excluir(remedio) {
    await cancelarAlarmes(remedio.notificationIds);
    const novaLista = await removerRemedio(remedio.id);
    setRemedios(novaLista);
  }

  function renderItem({ item }) {
    const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nome}>{item.nome}</Text>
          <Text style={styles.detalhe}>
            {item.quantidadePorDose} {unidadeTexto} · {(item.horarios || []).join(', ')}
          </Text>
          <Text style={styles.detalhe}>{descreverFrequencia(item.frequencia)}</Text>
          <Text style={styles.detalhe}>
            Estoque: {item.quantidadeAtual} {unidadeTexto}
          </Text>
        </View>
        <View style={styles.acoes}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdicionarRemedio', { remedioId: item.id })}
          >
            <Text style={styles.editar}>Editar</Text>
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
      <FlatList
        data={remedios}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum remédio cadastrado ainda.</Text>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nome: { fontSize: 18, fontWeight: '600' },
  detalhe: { color: '#666', marginTop: 2, fontSize: 13 },
  acoes: { alignItems: 'flex-end' },
  editar: { color: '#4A90D9', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  excluir: { color: '#D9534F', fontSize: 13 },
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

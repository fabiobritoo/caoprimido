import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { adicionarRemedio, atualizarRemedio, listarRemedios } from '../utils/storage';
import { agendarAlarmesRemedio, cancelarAlarmes, pedirPermissoes } from '../utils/notifications';
import { UNIDADES, DIAS_SEMANA, formatarData } from '../utils/constantes';

const FREQUENCIAS = [
  { valor: 'diaria', rotulo: 'Todos os dias' },
  { valor: 'dias_semana', rotulo: 'Dias específicos da semana' },
  { valor: 'intervalo', rotulo: 'A cada X dias (ex: dias alternados)' },
];

export default function AddMedicineScreen({ navigation, route }) {
  const remedioIdEdicao = route?.params?.remedioId || null;
  const modoEdicao = !!remedioIdEdicao;

  const [carregando, setCarregando] = useState(modoEdicao);
  const [remedioOriginal, setRemedioOriginal] = useState(null);

  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('comprimido');
  const [quantidadePorDose, setQuantidadePorDose] = useState('1');
  const [quantidadeAtual, setQuantidadeAtual] = useState('');
  const [quantidadeMinima, setQuantidadeMinima] = useState('');

  const [horarios, setHorarios] = useState([]);
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const [tipoFrequencia, setTipoFrequencia] = useState('diaria');
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState([]);
  const [intervaloDias, setIntervaloDias] = useState('2');

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: modoEdicao ? 'Editar Remédio' : 'Novo Remédio',
    });

    if (modoEdicao) {
      (async () => {
        const lista = await listarRemedios();
        const encontrado = lista.find((r) => r.id === remedioIdEdicao);
        if (encontrado) {
          setRemedioOriginal(encontrado);
          setNome(encontrado.nome);
          setUnidade(encontrado.unidade || 'comprimido');
          setQuantidadePorDose(String(encontrado.quantidadePorDose || 1));
          setQuantidadeAtual(String(encontrado.quantidadeAtual ?? ''));
          setQuantidadeMinima(String(encontrado.quantidadeMinima ?? ''));
          setHorarios(encontrado.horarios || []);

          const freq = encontrado.frequencia || { tipo: 'diaria' };
          setTipoFrequencia(freq.tipo);
          if (freq.tipo === 'dias_semana') setDiasSemanaSelecionados(freq.dias || []);
          if (freq.tipo === 'intervalo') setIntervaloDias(String(freq.intervaloDias || 2));
        }
        setCarregando(false);
      })();
    }
  }, []);

  function onChangeHorario(event, dataSelecionada) {
    setMostrarPicker(Platform.OS === 'ios');
    if (dataSelecionada) {
      const hh = String(dataSelecionada.getHours()).padStart(2, '0');
      const mm = String(dataSelecionada.getMinutes()).padStart(2, '0');
      const horario = `${hh}:${mm}`;
      if (!horarios.includes(horario)) {
        setHorarios([...horarios, horario].sort());
      }
    }
  }

  function removerHorario(horario) {
    setHorarios(horarios.filter((h) => h !== horario));
  }

  function alternarDiaSemana(dia) {
    if (diasSemanaSelecionados.includes(dia)) {
      setDiasSemanaSelecionados(diasSemanaSelecionados.filter((d) => d !== dia));
    } else {
      setDiasSemanaSelecionados([...diasSemanaSelecionados, dia].sort());
    }
  }

  function montarFrequencia() {
    const hoje = formatarData(new Date());

    if (tipoFrequencia === 'diaria') {
      return { tipo: 'diaria' };
    }
    if (tipoFrequencia === 'dias_semana') {
      return { tipo: 'dias_semana', dias: diasSemanaSelecionados };
    }
    if (tipoFrequencia === 'intervalo') {
      // Se já era "intervalo" antes da edição, preserva a data de início original
      // (senão o histórico de dias passados fica incorreto). Só usa hoje se for novo.
      const dataInicioExistente =
        remedioOriginal?.frequencia?.tipo === 'intervalo'
          ? remedioOriginal.frequencia.dataInicio
          : null;
      return {
        tipo: 'intervalo',
        intervaloDias: Number(intervaloDias) || 2,
        dataInicio: dataInicioExistente || hoje,
        proximaData: hoje,
      };
    }
    return { tipo: 'diaria' };
  }

  async function salvar() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do remédio.');
      return;
    }
    if (horarios.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um horário.');
      return;
    }
    if (!quantidadeAtual) {
      Alert.alert('Atenção', 'Informe a quantidade atual em estoque.');
      return;
    }
    if (tipoFrequencia === 'dias_semana' && diasSemanaSelecionados.length === 0) {
      Alert.alert('Atenção', 'Selecione ao menos um dia da semana.');
      return;
    }

    setSalvando(true);

    const permitido = await pedirPermissoes();
    if (!permitido) {
      Alert.alert('Permissão necessária', 'Ative as notificações para receber os alarmes.');
    }

    const frequencia = montarFrequencia();

    const dadosRemedio = {
      nome: nome.trim(),
      unidade,
      quantidadePorDose: Number(quantidadePorDose) || 1,
      dosagem: `${quantidadePorDose} ${unidade}`,
      horarios,
      frequencia,
      quantidadeAtual: Number(quantidadeAtual),
      quantidadeMinima: Number(quantidadeMinima) || 5,
    };

    if (modoEdicao) {
      // Cancela os alarmes antigos e cria novos com os dados atualizados
      await cancelarAlarmes(remedioOriginal.notificationIds || []);
      const novosIds = await agendarAlarmesRemedio({ ...dadosRemedio, id: remedioIdEdicao });
      await atualizarRemedio(remedioIdEdicao, { ...dadosRemedio, notificationIds: novosIds });
    } else {
      const novoRemedio = {
        id: Date.now().toString(),
        ...dadosRemedio,
        notificationIds: [],
      };
      const notificationIds = await agendarAlarmesRemedio(novoRemedio);
      novoRemedio.notificationIds = notificationIds;
      await adicionarRemedio(novoRemedio);
    }

    setSalvando(false);
    navigation.goBack();
  }

  if (carregando) {
    return (
      <View style={styles.carregandoContainer}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Nome do remédio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Losartana"
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Unidade de medida</Text>
      <View style={styles.opcoesLinha}>
        {UNIDADES.map((u) => (
          <TouchableOpacity
            key={u.valor}
            style={[styles.opcaoChip, unidade === u.valor && styles.opcaoChipSelecionada]}
            onPress={() => setUnidade(u.valor)}
          >
            <Text
              style={[
                styles.opcaoChipTexto,
                unidade === u.valor && styles.opcaoChipTextoSelecionado,
              ]}
            >
              {u.rotulo}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Quantidade por dose</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 1"
        keyboardType="numeric"
        value={quantidadePorDose}
        onChangeText={setQuantidadePorDose}
      />

      <Text style={styles.label}>Horários do alarme</Text>
      <TouchableOpacity
        style={styles.botaoSecundario}
        onPress={() => setMostrarPicker(true)}
      >
        <Text style={styles.botaoSecundarioTexto}>+ Adicionar horário</Text>
      </TouchableOpacity>

      {mostrarPicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour
          display="default"
          onChange={onChangeHorario}
        />
      )}

      <View style={styles.listaHorarios}>
        {horarios.map((h) => (
          <TouchableOpacity
            key={h}
            style={styles.chip}
            onPress={() => removerHorario(h)}
          >
            <Text style={styles.chipTexto}>{h} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Frequência</Text>
      <View style={{ gap: 8 }}>
        {FREQUENCIAS.map((f) => (
          <TouchableOpacity
            key={f.valor}
            style={styles.opcaoLinhaRadio}
            onPress={() => setTipoFrequencia(f.valor)}
          >
            <View
              style={[
                styles.radioCirculo,
                tipoFrequencia === f.valor && styles.radioCirculoSelecionado,
              ]}
            />
            <Text style={styles.radioTexto}>{f.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tipoFrequencia === 'dias_semana' && (
        <View style={styles.opcoesLinha}>
          {DIAS_SEMANA.map((d) => (
            <TouchableOpacity
              key={d.valor}
              style={[
                styles.diaCirculo,
                diasSemanaSelecionados.includes(d.valor) && styles.diaCirculoSelecionado,
              ]}
              onPress={() => alternarDiaSemana(d.valor)}
            >
              <Text
                style={[
                  styles.diaCirculoTexto,
                  diasSemanaSelecionados.includes(d.valor) &&
                    styles.diaCirculoTextoSelecionado,
                ]}
              >
                {d.curto}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {tipoFrequencia === 'intervalo' && (
        <View>
          <Text style={styles.subLabel}>
            A cada quantos dias? (2 = dias alternados)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 2"
            keyboardType="numeric"
            value={intervaloDias}
            onChangeText={setIntervaloDias}
          />
        </View>
      )}

      <Text style={styles.label}>Quantidade atual em estoque</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 30"
        keyboardType="numeric"
        value={quantidadeAtual}
        onChangeText={setQuantidadeAtual}
      />

      <Text style={styles.label}>Avisar quando restar (quantidade mínima)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 5"
        keyboardType="numeric"
        value={quantidadeMinima}
        onChangeText={setQuantidadeMinima}
      />

      <TouchableOpacity
        style={styles.botaoSalvar}
        onPress={salvar}
        disabled={salvando}
      >
        <Text style={styles.botaoSalvarTexto}>
          {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar remédio'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  carregandoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 6 },
  subLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  botaoSecundario: {
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  botaoSecundarioTexto: { color: '#4A90D9', fontWeight: '600' },
  listaHorarios: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  chip: {
    backgroundColor: '#EAF2FB',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipTexto: { color: '#4A90D9', fontWeight: '600' },
  opcoesLinha: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  opcaoChip: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  opcaoChipSelecionada: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  opcaoChipTexto: { color: '#444' },
  opcaoChipTextoSelecionado: { color: '#fff', fontWeight: '600' },
  opcaoLinhaRadio: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  radioCirculo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#AAA',
    marginRight: 10,
  },
  radioCirculoSelecionado: { borderColor: '#4A90D9', backgroundColor: '#4A90D9' },
  radioTexto: { fontSize: 15 },
  diaCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  diaCirculoSelecionado: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  diaCirculoTexto: { color: '#444', fontWeight: '600' },
  diaCirculoTextoSelecionado: { color: '#fff' },
  botaoSalvar: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  botaoSalvarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

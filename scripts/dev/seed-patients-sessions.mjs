import { createPrivateKey, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

const generateEs256TokenFromDocker = async () => {
  const { stdout: psStdout } = await execFileAsync("docker", [
    "ps",
    "--filter",
    "name=supabase_auth_",
    "--format",
    "{{.Names}}",
  ]);
  const containerName = psStdout.trim().split("\n")[0];
  const { stdout: envStdout } = await execFileAsync("docker", [
    "exec",
    containerName,
    "env",
  ]);

  const jwtKeysMatch = envStdout.match(/^GOTRUE_JWT_KEYS=(.*)$/m);
  const jwkList = JSON.parse(jwtKeysMatch[1]);
  const es256Jwk = jwkList.find((key) => key.alg === "ES256" && key.d);
  const key = createPrivateKey({ key: es256Jwk, format: "jwk" });
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: es256Jwk.kid, typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-demo",
      role: "service_role",
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400,
    })
  ).toString("base64url");
  const signature = sign("SHA256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `${header}.${payload}.${signature}`;
};

const CLINIC_ID = "f4318cd7-9089-453b-a793-f9bbca8550fd";
const USER_ID = "fb266abe-87ad-4f19-a60a-07c0ccdc23e5";

const PATIENTS_DATA = [
  {
    name: "Lucas Gabriel Fernandes",
    date_of_birth: "1994-03-12",
    age: 32,
    gender: "masculino",
    pronoun: "ele/dele",
    phone: "11981234501",
    email: "lucas.fernandes@example.com",
    groups: [
      { name: "Reabilitação de Joelho", color: "#60A5FA" },
      { name: "Fisioterapia Esportiva", color: "#34D399" }
    ],
    sessions: [
      {
        session_date: "2026-08-10T09:00:00.000Z",
        scheduled_start_at: "2026-08-10T09:00:00.000Z",
        patient_arrived_at: "2026-08-10T08:55:00.000Z",
        queixa: "Dor aguda no tendão patelar direito ao subir escadas e após corrida.",
        sintomas: "Edema leve no tendão patelar, dor à palpação local, EVA 7/10.",
        observacoes: "Avaliação inicial e testes ortopédicos específicos realizados com sucesso.",
        pain_score: 7,
        complexity_score: 2,
        payment_method: "pix",
        payment_status: "pago",
        amount_original_cents: 18000,
        amount_charged_cents: 18000,
        amount_paid_cents: 18000,
        payment_installments: 1,
        payment_status_date: "2026-08-10",
        notes: "Paciente orientado sobre repouso relativo e crioterapia domiciliar."
      },
      {
        session_date: "2026-08-14T09:00:00.000Z",
        scheduled_start_at: "2026-08-14T09:00:00.000Z",
        patient_arrived_at: "2026-08-14T08:58:00.000Z",
        queixa: "Dor reduzida após repouso, mas ainda com incômodo em agachamentos.",
        sintomas: "Diminuição do edema, sensibilidade moderada, EVA 5/10.",
        observacoes: "Aplicação de crioterapia e eletroestimulação analgésica TENS.",
        pain_score: 5,
        complexity_score: 2,
        payment_method: "cartao_credito",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 2,
        payment_status_date: "2026-08-14",
        notes: "Realizada liberação miofascial de reto femoral e tensor da fáscia lata."
      },
      {
        session_date: "2026-08-18T09:00:00.000Z",
        scheduled_start_at: "2026-08-18T09:00:00.000Z",
        patient_arrived_at: "2026-08-18T09:00:00.000Z",
        queixa: "Melhora evidente na marcha e subida de escadas.",
        sintomas: "Ausência de falseios, crepitação mínima, dor EVA 3/10.",
        observacoes: "Início de isometria de quadríceps em plano inclinado.",
        pain_score: 3,
        complexity_score: 1,
        payment_method: "cartao_debito",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 1,
        payment_status_date: "2026-08-18",
        notes: "Boa resposta muscular, sem queixa de dor residual no pós-exercício."
      },
      {
        session_date: "2026-08-22T09:00:00.000Z",
        scheduled_start_at: "2026-08-22T09:00:00.000Z",
        patient_arrived_at: "2026-08-22T08:52:00.000Z",
        queixa: "Sem dor nas atividades diárias, pronto para retorno aos treinos.",
        sintomas: "Mobilidade e força 100% simétricas, dor EVA 1/10.",
        observacoes: "Treino excêntrico avançado e protocolo de retorno ao esporte concluído.",
        pain_score: 1,
        complexity_score: 1,
        payment_method: "dinheiro",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 1,
        payment_status_date: "2026-08-22",
        notes: "Alta fisioterapêutica com orientações de prevenção e fortalecimento."
      }
    ]
  },
  {
    name: "Camila Beatriz Rocha",
    date_of_birth: "1988-07-25",
    age: 38,
    gender: "feminino",
    pronoun: "ela/dela",
    phone: "11972345612",
    email: "camila.rocha@example.com",
    groups: [
      { name: "Coluna Lombar", color: "#F87171" },
      { name: "Pilates Clínico", color: "#A78BFA" }
    ],
    sessions: [
      {
        session_date: "2026-08-08T14:00:00.000Z",
        scheduled_start_at: "2026-08-08T14:00:00.000Z",
        patient_arrived_at: "2026-08-08T13:50:00.000Z",
        queixa: "Dor lombar intensa com irradiação para a região glútea esquerda.",
        sintomas: "Teste de Lasègue positivo a 45°, parestesia em dermátomo L5, EVA 8/10.",
        observacoes: "Avaliação da coluna lombar e testes neurológicos com presença de ciatalgia.",
        pain_score: 8,
        complexity_score: 3,
        payment_method: "pix",
        payment_status: "pago",
        amount_original_cents: 20000,
        amount_charged_cents: 20000,
        amount_paid_cents: 20000,
        payment_installments: 1,
        payment_status_date: "2026-08-08",
        notes: "Prescrito posicionamento de alívio e orientações ergonômicas para trabalho sentado."
      },
      {
        session_date: "2026-08-12T14:00:00.000Z",
        scheduled_start_at: "2026-08-12T14:00:00.000Z",
        patient_arrived_at: "2026-08-12T14:00:00.000Z",
        queixa: "Redução da dor irradiada na perna após as orientações posturais.",
        sintomas: "Dor concentrada na lombar baixa, melhora na marcha, EVA 5/10.",
        observacoes: "Técnicas de descompressão axial suave e mobilização do nervo ciático.",
        pain_score: 5,
        complexity_score: 2,
        payment_method: "transferencia",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 1,
        payment_status_date: "2026-08-12",
        notes: "Sintomas centralizados na linha média, excelente prognóstico mecânico."
      },
      {
        session_date: "2026-08-16T14:00:00.000Z",
        scheduled_start_at: "2026-08-16T14:00:00.000Z",
        patient_arrived_at: "2026-08-16T13:55:00.000Z",
        queixa: "Desconforto apenas ao permanecer mais de 3 horas sentada.",
        sintomas: "Sem dormência nos membros inferiores, teste de Lasègue negativo, EVA 3/10.",
        observacoes: "Exercícios de estabilização segmentar e ativação de transverso do abdômen.",
        pain_score: 3,
        complexity_score: 2,
        payment_method: "cartao_debito",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 1,
        payment_status_date: "2026-08-16",
        notes: "Excelente controle motor durante a dissociação lombo-pélvica."
      },
      {
        session_date: "2026-08-20T14:00:00.000Z",
        scheduled_start_at: "2026-08-20T14:00:00.000Z",
        patient_arrived_at: "2026-08-20T13:58:00.000Z",
        queixa: "Sem queixas álgicas na rotina diária ou nas tarefas profissionais.",
        sintomas: "Mobilidade lombar completa, sem limitações funcionais, EVA 0/10.",
        observacoes: "Treino de movimentos no Reformer e orientações para manutenção preventiva.",
        pain_score: 0,
        complexity_score: 1,
        payment_method: "cartao_credito",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 1,
        payment_status_date: "2026-08-20",
        notes: "Paciente liberada para manutenção no pilates clínico preventivo."
      }
    ]
  },
  {
    name: "Rodrigo Albuquerque Martins",
    date_of_birth: "1979-11-04",
    age: 46,
    gender: "masculino",
    pronoun: "ele/dele",
    phone: "11963456723",
    email: "rodrigo.martins@example.com",
    groups: [
      { name: "Ombro e Membros Superiores", color: "#FBBF24" },
      { name: "Terapia Manual", color: "#EC4899" }
    ],
    sessions: [
      {
        session_date: "2026-08-09T10:30:00.000Z",
        scheduled_start_at: "2026-08-09T10:30:00.000Z",
        patient_arrived_at: "2026-08-09T10:25:00.000Z",
        queixa: "Rigidez severa e dor contínua no ombro direito ao levantar o braço.",
        sintomas: "Capsulite adesiva em fase de congelamento, abdução limitada a 60°, EVA 8/10.",
        observacoes: "Avaliação cinemática da cintura escapular e mensuração de ADM por goniometria.",
        pain_score: 8,
        complexity_score: 3,
        payment_method: "cartao_credito",
        payment_status: "pago",
        amount_original_cents: 18000,
        amount_charged_cents: 18000,
        amount_paid_cents: 18000,
        payment_installments: 3,
        payment_status_date: "2026-08-09",
        notes: "Realizada termoterapia prévia e trações glenoumerais de grau I/II para analgesia."
      },
      {
        session_date: "2026-08-13T10:30:00.000Z",
        scheduled_start_at: "2026-08-13T10:30:00.000Z",
        patient_arrived_at: "2026-08-13T10:30:00.000Z",
        queixa: "Dor noturna atenuada, permitindo melhor repouso.",
        sintomas: "Ganho de 15° de elevação anterior, melhora no deslizamento posterior, EVA 6/10.",
        observacoes: "Mobilização articular com deslizamentos glenoumerais e oscilações de Maitland.",
        pain_score: 6,
        complexity_score: 2,
        payment_method: "pix",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 1,
        payment_status_date: "2026-08-13",
        notes: "Exercícios pendulares de Codman e auto-alongamentos passivos domiciliares."
      },
      {
        session_date: "2026-08-17T10:30:00.000Z",
        scheduled_start_at: "2026-08-17T10:30:00.000Z",
        patient_arrived_at: "2026-08-17T10:20:00.000Z",
        queixa: "Consegue alcançar objetos na altura dos olhos com menor esforço.",
        sintomas: "Abdução ativa atingindo 120°, dor apenas no final da amplitude, EVA 4/10.",
        observacoes: "Técnicas de mobilização com movimento (MWM de Mulligan) e liberação capsular.",
        pain_score: 4,
        complexity_score: 2,
        payment_method: "dinheiro",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 1,
        payment_status_date: "2026-08-17",
        notes: "Paciente refere redução substancial do consumo de analgésicos."
      },
      {
        session_date: "2026-08-21T10:30:00.000Z",
        scheduled_start_at: "2026-08-21T10:30:00.000Z",
        patient_arrived_at: "2026-08-21T10:28:00.000Z",
        queixa: "Sensação de liberdade de movimentos quase completa para o trabalho.",
        sintomas: "ADM ativa quase plena (160° de elevação), ritmo escapular normalizado, EVA 2/10.",
        observacoes: "Fortalecimento do manguito rotador com theraband e treino funcional.",
        pain_score: 2,
        complexity_score: 1,
        payment_method: "cartao_debito",
        payment_status: "pago",
        amount_original_cents: 15000,
        amount_charged_cents: 15000,
        amount_paid_cents: 15000,
        payment_installments: 1,
        payment_status_date: "2026-08-21",
        notes: "Evolução clínica exemplar, foco atual em ganho de resistência muscular."
      }
    ]
  },
  {
    name: "Juliana Mendes Fonseca",
    date_of_birth: "2001-09-18",
    age: 24,
    gender: "feminino",
    pronoun: "ela/dela",
    phone: "11954567834",
    email: "juliana.fonseca@example.com",
    groups: [
      { name: "Tornozelo e Pé", color: "#10B981" },
      { name: "Propriocepção e Fortalecimento", color: "#3B82F6" }
    ],
    sessions: [
      {
        session_date: "2026-08-11T16:00:00.000Z",
        scheduled_start_at: "2026-08-11T16:00:00.000Z",
        patient_arrived_at: "2026-08-11T15:55:00.000Z",
        queixa: "Entorse em inversão do tornozelo direito durante partida de voleibol há 3 dias.",
        sintomas: "Edema difuso peri-maleolar, equimose lateral, dor aguda à descarga de peso, EVA 7/10.",
        observacoes: "Avaliação do ligamento talofibular anterior e calcaneofibular.",
        pain_score: 7,
        complexity_score: 2,
        payment_method: "pix",
        payment_status: "pago",
        amount_original_cents: 17000,
        amount_charged_cents: 17000,
        amount_paid_cents: 17000,
        payment_installments: 1,
        payment_status_date: "2026-08-11",
        notes: "Aplicação de bota pneumática de compressão e drenagem linfática manual."
      },
      {
        session_date: "2026-08-15T16:00:00.000Z",
        scheduled_start_at: "2026-08-15T16:00:00.000Z",
        patient_arrived_at: "2026-08-15T15:58:00.000Z",
        queixa: "Inchaço visivelmente menor, consegue apoiar o pé no chão sem muletas.",
        sintomas: "Equimose em absorção, redução do edema em 60%, EVA 5/10.",
        observacoes: "Laserterapia de baixa intensidade e mobilização passiva subtalar.",
        pain_score: 5,
        complexity_score: 2,
        payment_method: "cartao_debito",
        payment_status: "pago",
        amount_original_cents: 14000,
        amount_charged_cents: 14000,
        amount_paid_cents: 14000,
        payment_installments: 1,
        payment_status_date: "2026-08-15",
        notes: "Iniciados exercícios isométricos de eversão e dorsiflexão com theraband leve."
      },
      {
        session_date: "2026-08-19T16:00:00.000Z",
        scheduled_start_at: "2026-08-19T16:00:00.000Z",
        patient_arrived_at: "2026-08-19T15:50:00.000Z",
        queixa: "Caminhando normalmente na rua, sem sensação de falseio.",
        sintomas: "Ausência de edema residual, amplitude de dorsiflexão simétrica, EVA 2/10.",
        observacoes: "Treino proprioceptivo em disco de equilíbrio e cama elástica.",
        pain_score: 2,
        complexity_score: 1,
        payment_method: "transferencia",
        payment_status: "pago",
        amount_original_cents: 14000,
        amount_charged_cents: 14000,
        amount_paid_cents: 14000,
        payment_installments: 1,
        payment_status_date: "2026-08-19",
        notes: "Excelente controle neuromuscular e equilíbrio unipodal demonstrados."
      },
      {
        session_date: "2026-08-23T16:00:00.000Z",
        scheduled_start_at: "2026-08-23T16:00:00.000Z",
        patient_arrived_at: "2026-08-23T16:00:00.000Z",
        queixa: "Sem qualquer dor ou limitação durante simulação de corrida e saltos.",
        sintomas: "Estabilidade ligamentar excelente em testes dinâmicos, EVA 0/10.",
        observacoes: "Pliometria progressiva, mudança brusca de direção e alta para retorno às quadras.",
        pain_score: 0,
        complexity_score: 1,
        payment_method: "cartao_credito",
        payment_status: "pago",
        amount_original_cents: 14000,
        amount_charged_cents: 14000,
        amount_paid_cents: 14000,
        payment_installments: 1,
        payment_status_date: "2026-08-23",
        notes: "Paciente orientada sobre aquecimento dinâmico antes dos jogos."
      }
    ]
  },
  {
    name: "Eduardo Henrique Vianna",
    date_of_birth: "1965-04-30",
    age: 61,
    gender: "masculino",
    pronoun: "ele/dele",
    phone: "11945678945",
    email: "eduardo.vianna@example.com",
    groups: [
      { name: "Coluna Cervical", color: "#8B5CF6" },
      { name: "Liberação Miofascial", color: "#F59E0B" }
    ],
    sessions: [
      {
        session_date: "2026-08-07T11:00:00.000Z",
        scheduled_start_at: "2026-08-07T11:00:00.000Z",
        patient_arrived_at: "2026-08-07T10:45:00.000Z",
        queixa: "Cervicobraquialgia crônica com queimação e espasmo em trapézio superior esquerdo.",
        sintomas: "Trigger points ativos em trapézio e elevador da escápula, cefaleia tensional, EVA 8/10.",
        observacoes: "Avaliação postural estática e dinâmica demonstrando anteriorização de cabeça.",
        pain_score: 8,
        complexity_score: 2,
        payment_method: "cartao_debito",
        payment_status: "pago",
        amount_original_cents: 19000,
        amount_charged_cents: 19000,
        amount_paid_cents: 19000,
        payment_installments: 1,
        payment_status_date: "2026-08-07",
        notes: "Realizada tração cervical mecânica manual e agulhamento a seco em pontos-gatilho."
      },
      {
        session_date: "2026-08-11T11:00:00.000Z",
        scheduled_start_at: "2026-08-11T11:00:00.000Z",
        patient_arrived_at: "2026-08-11T10:55:00.000Z",
        queixa: "Cefaleia cessou e diminuiu a irradiação para o braço esquerdo.",
        sintomas: "Mobilidade cervical com ganho de 20° em rotação bilateral, dor EVA 5/10.",
        observacoes: "Liberação miofascial instrumental (IASTM) em musculatura paravertebral cervical.",
        pain_score: 5,
        complexity_score: 2,
        payment_method: "pix",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 1,
        payment_status_date: "2026-08-11",
        notes: "Exercícios de retração cervical (Método McKenzie) instruídos para realização domiciliar."
      },
      {
        session_date: "2026-08-15T11:00:00.000Z",
        scheduled_start_at: "2026-08-15T11:00:00.000Z",
        patient_arrived_at: "2026-08-15T10:58:00.000Z",
        queixa: "Sem episódios de irradiação para o braço durante a semana de trabalho.",
        sintomas: "Tensão muscular leve apenas no final do expediente, dor EVA 3/10.",
        observacoes: "Fortalecimento de flexores profundos da cervical e estabilizadores escapulares.",
        pain_score: 3,
        complexity_score: 1,
        payment_method: "cartao_credito",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 2,
        payment_status_date: "2026-08-15",
        notes: "Adequação do posto de trabalho e altura dos monitores revisada com o paciente."
      },
      {
        session_date: "2026-08-19T11:00:00.000Z",
        scheduled_start_at: "2026-08-19T11:00:00.000Z",
        patient_arrived_at: "2026-08-19T11:00:00.000Z",
        queixa: "Trabalhando normalmente com postura adequada e sem dor cervical.",
        sintomas: "Amplitude cervical 100% livre e indolor, tônus muscular normotenso, EVA 0/10.",
        observacoes: "Treino de resistência isométrica cervical e orientações de pausas ativas.",
        pain_score: 0,
        complexity_score: 1,
        payment_method: "dinheiro",
        payment_status: "pago",
        amount_original_cents: 16000,
        amount_charged_cents: 16000,
        amount_paid_cents: 16000,
        payment_installments: 1,
        payment_status_date: "2026-08-19",
        notes: "Alta do tratamento intensivo com plano de exercícios de manutenção."
      }
    ]
  }
];

async function seed() {
  console.log("Iniciando criação de 5 pacientes e 20 atendimentos pagos com sintomas variados...");
  const token = await generateEs256TokenFromDocker();
  if (!token) {
    console.error("Falha ao gerar token.");
    return;
  }

  const supabase = createClient("http://127.0.0.1:54321", token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Obter último patient_code para continuar a numeração
  const { data: existingPatients, error: pErr } = await supabase
    .from("patients")
    .select("patient_code")
    .eq("clinic_id", CLINIC_ID);

  if (pErr) {
    console.error("Erro ao buscar pacientes existentes:", pErr);
    return;
  }

  let nextCodeNum = 1;
  for (const p of existingPatients || []) {
    if (p.patient_code && p.patient_code.startsWith("PAC-")) {
      const num = parseInt(p.patient_code.replace("PAC-", ""), 10);
      if (!isNaN(num) && num >= nextCodeNum) {
        nextCodeNum = num + 1;
      }
    }
  }

  console.log(`Próximo patient_code inicial: PAC-${String(nextCodeNum).padStart(3, "0")}`);

  let totalPatientsCreated = 0;
  let totalSessionsCreated = 0;

  for (const pData of PATIENTS_DATA) {
    const patientCode = `PAC-${String(nextCodeNum).padStart(3, "0")}`;
    nextCodeNum++;

    console.log(`\nCriando paciente: ${pData.name} (${patientCode})...`);

    // Inserir paciente
    const { data: patient, error: insertPatientError } = await supabase
      .from("patients")
      .insert({
        clinic_id: CLINIC_ID,
        user_id: USER_ID,
        name: pData.name,
        patient_code: patientCode,
        date_of_birth: pData.date_of_birth,
        age: pData.age,
        gender: pData.gender,
        pronoun: pData.pronoun,
        phone: pData.phone,
        email: pData.email,
        country: "Brasil",
        status: "ativo",
        is_recurring: true,
        recurring_weekdays: [1, 3],
        recurring_time: "09:00",
        origin_type: "indicacao",
        registration_complete: true
      })
      .select()
      .single();

    if (insertPatientError || !patient) {
      console.error(`Erro ao inserir paciente ${pData.name}:`, insertPatientError);
      continue;
    }

    totalPatientsCreated++;
    console.log(`✅ Paciente criado com sucesso! ID: ${patient.id}`);

    // Inserir grupos clínicos / linhas de cuidado para o paciente
    const createdGroupIds = [];
    for (const g of pData.groups) {
      const { data: grp, error: grpError } = await supabase
        .from("patient_groups")
        .insert({
          clinic_id: CLINIC_ID,
          patient_id: patient.id,
          user_id: USER_ID,
          name: g.name,
          color: g.color,
          status: "em_andamento",
          is_default: false,
          group_kind: "custom"
        })
        .select("id")
        .single();

      if (!grpError && grp) {
        createdGroupIds.push(grp.id);
      }
    }

    // Inserir evolution_group para histórico clínico sequencial
    const { data: evoGroup } = await supabase
      .from("patient_evolution_groups")
      .insert({
        clinic_id: CLINIC_ID,
        patient_id: patient.id,
        custom_name: pData.groups[0]?.name || "Ciclo de Fisioterapia"
      })
      .select("id")
      .single();

    const evolutionGroupId = evoGroup?.id || null;
    let parentSessionId = null;

    // Inserir os 4 atendimentos para o paciente
    for (let i = 0; i < pData.sessions.length; i++) {
      const sData = pData.sessions[i];
      const sessionPayload = {
        clinic_id: CLINIC_ID,
        user_id: USER_ID,
        provider_id: USER_ID,
        patient_id: patient.id,
        group_id: createdGroupIds[0] || null,
        evolution_group_id: evolutionGroupId,
        parent_session_id: parentSessionId,
        session_date: sData.session_date,
        scheduled_start_at: sData.scheduled_start_at,
        patient_arrived_at: sData.patient_arrived_at,
        status: "concluído",
        pain_score: sData.pain_score,
        complexity_score: sData.complexity_score,
        payment_status: sData.payment_status,
        payment_method: sData.payment_method,
        payment_installments: sData.payment_installments,
        payment_status_date: sData.payment_status_date,
        amount_original_cents: sData.amount_original_cents,
        amount_charged_cents: sData.amount_charged_cents,
        amount_paid_cents: sData.amount_paid_cents,
        notes: sData.notes,
        anamnesis: {
          queixa: sData.queixa,
          sintomas: sData.sintomas,
          observacoes: sData.observacoes,
          care_line_ids: createdGroupIds
        },
        anamnesis_form_response: {
          main_complaint: sData.queixa,
          sintomas: sData.sintomas
        },
        treatment: {
          generalGuidance: sData.notes,
          blocks: [
            {
              id: `block-${i + 1}`,
              title: `Conduta - Sessão #${i + 1}`,
              exercises: [
                {
                  name: `Protocolo Clínico ${i + 1}`,
                  sets: "3",
                  reps: "12",
                  notes: sData.observacoes
                }
              ]
            }
          ]
        }
      };

      const { data: sessionRecord, error: sessionError } = await supabase
        .from("sessions")
        .insert(sessionPayload)
        .select("id")
        .single();

      if (sessionError || !sessionRecord) {
        console.error(`  ❌ Erro ao criar atendimento #${i + 1}:`, sessionError);
      } else {
        totalSessionsCreated++;
        parentSessionId = sessionRecord.id;
        console.log(`  ✅ Atendimento #${i + 1} criado! ID: ${sessionRecord.id} | Pagamento: ${sData.payment_method} (R$ ${(sData.amount_paid_cents / 100).toFixed(2)}) - Pago`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Processo concluído!`);
  console.log(`Total de novos pacientes criados: ${totalPatientsCreated}`);
  console.log(`Total de atendimentos criados: ${totalSessionsCreated}`);
  console.log(`========================================\n`);
}

seed();

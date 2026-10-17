// JSON estático memoizado do WhatsApp Flow para evitar JSON.stringify custoso a cada re-render
export const SAMPLE_WHATSAPP_FLOW_JSON = JSON.stringify({
  version: "3.1",
  data_api_version: "3.0",
  routing_model: {
    TRIAGE_SCREEN: ["PREFERENCES_SCREEN"],
    PREFERENCES_SCREEN: []
  },
  screens: [
    {
      id: "TRIAGE_SCREEN",
      title: "Triagem & Agendamento Clínico",
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "TextInput",
                name: "full_name",
                label: "Nome Completo",
                required: true
              },
              {
                type: "RadioButtonsGroup",
                name: "appointment_type",
                label: "Tipo de Atendimento",
                required: true,
                "data-source": [
                  { id: "primeira_consulta", title: "Primeira Consulta / Avaliação" },
                  { id: "retorno_sessao", title: "Sessão de Acompanhamento" },
                  { id: "orientacao_online", title: "Teleconsulta Online" }
                ]
              },
              {
                type: "Footer",
                label: "Continuar",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "PREFERENCES_SCREEN"
                  },
                  payload: {
                    full_name: "${form.full_name}",
                    appointment_type: "${form.appointment_type}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "PREFERENCES_SCREEN",
      title: "Preferência de Horário",
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "DatePicker",
                name: "preferred_date",
                label: "Data Desejada",
                required: true
              },
              {
                type: "Footer",
                label: "Concluir Triagem",
                "on-click-action": {
                  name: "complete",
                  payload: {
                    preferred_date: "${form.preferred_date}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}, null, 2);

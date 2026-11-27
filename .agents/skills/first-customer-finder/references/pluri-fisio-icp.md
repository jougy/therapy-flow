# ICP & Sinais de Dor Ativa — Pluri Fisio

## 1. Produto & Posicionamento
* **Produto:** **Pluri Fisio** — sistema web/mobile focado em **fisioterapeutas autônomos, atendimento domiciliar, estúdios de Pilates clínico e clínicas pequenas (1–5 profissionais)**.
* **Dores principais que resolvemos:**
  1. **Prontuário / Evolução CREFITO & CFM:** perda de tempo escrevendo fichas em papel, Word ou Google Docs após o expediente.
  2. **Agenda & Faltas no WhatsApp:** pacientes esquecendo horário, remarcações desorganizadas e confirmação manual no WhatsApp.
  3. **Financeiro de Pacotes e Sessões:** dificuldade para controlar quem pagou pacote fechado, quantas sessões restam e fluxo de caixa mensal.
  4. **Complexidade / Preço de ERPs grandes:** sistemas hospitalares ou caros demais que exigem dezenas de cliques só para evoluir um atendimento.

## 2. Segmentos de ICP (`icp_tier`)
| `icp_tier` | Perfil | Sinais típicos |
| :--- | :--- | :--- |
| `solo_physio` | Autônomo, domiciliar (home care) ou consultório individual; inclui **recém-formados com CREFITO novo** e **experientes ainda no papel/planilha** | "atendo em domicílio", "CREFITO novo", "começando a atender", "anoto tudo no caderno/planilha", "preciso de um app simples" |
| `clinic_owner` | Dono(a) de clínica enxuta (1–5 salas/fisioterapeutas) | "abrindo minha clínica", "montando consultório", "equipe pequena", "precisamos unificar agenda e prontuário" |
| `studio_pilates` | Dono(a) de estúdio de Pilates Clínico / RPG | "estúdio de pilates", "controle de turmas e reposições", "evolução de alunos", "mensalidades em planilha" |
| `student` | Estudante / estagiário (baixa prioridade / nutrir só se estiver formando) | "TCC", "estágio", "faculdade", "prova" |
| `other` | Fora do perfil (descartar) | Pacientes buscando fisioterapia, vendedores, RH |

## 3. Queries Prontas para `search_web` (PT-BR)
Use variações combinando canal público + termo de dor recente (últimos 30–180 dias):
* `"indicação de sistema para fisioterapia"` OR `"app de prontuário fisioterapeuta"`
* `"prontuário fisioterapia" (planilha OR papel OR caderno OR "dando trabalho")`
* `"sistema para clínica de fisioterapia" (barato OR simples OR reclamação)`
* `(site:reddit.com OR site:x.com) ("fisioterapeuta" OR "pilates") (prontuário OR agenda OR paciente faltou OR planilha)`
* `site:instagram.com ("fisioterapia domiciliar" OR "consultório de fisioterapia") ("abrindo" OR "CREFITO" OR "agenda aberta")`
* `"trocar de sistema" "fisioterapia" OR "suporte ruim" sistema fisioterapia`

## 4. Desqualificadores Rígidos (Checagem de Contra-Evidência)
Descarte ou reprove na checagem de contra-evidência sempre que o texto indicar:
1. **Paciente procurando tratamento:** *"procuro fisioterapeuta para dor lombar em SP"*, *"quanto custa sessão"*.
2. **Oferta de vaga / emprego / estágio:** *"vaga para fisioterapeuta PJ"*, *"envie seu currículo"*.
3. **Vendedor de curso, ebook, templates ou equipamentos:** links `hotmart.com`, `kiwify`, *"pack de artes"*, *"vendo maca/aparelho"*.
4. **Problema já resolvido / satisfeito com concorrente:** *"já uso o sistema X há 3 anos e amo, super recomendo"* (não tem dor aberta — apenas marque contra-evidência como falhada).

## 5. Diretriz Inegociável de Tom & Formalidade
Todas as recomendações e mensagens da Pluri Fisio devem soar:
> **Natural, humano e simpático, sem perder o profissionalismo e a formalidade.**

* **FAÇA:** Use saudação cordial (`Olá, Dr(a). [Nome], tudo bem?` ou `Oi, [Nome], tudo bem?`), faça referência respeitosa ao contexto real da dor sem parecer stalker, faça apenas **1 pergunta aberta curta** para gerar conversa genuína.
* **EVITE:** *"Oportunidade imperdível!"*, *"Últimas vagas!"*, gírias informais (`mano`, `galera`, `top demais`), parágrafos longos na 1ª mensagem (`> 380 caracteres`), ou chuva de emojis.

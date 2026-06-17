# Eventos — Workflows do n8n (Etapa 6C)

O ClinicOS cuida da interface (lista de aniversariantes, mensagem, campanhas).
O **envio** e a **leitura do contexto** são feitos pelo n8n. São 2 workflows.

> Configuração no ClinicOS: **Configurações → Webhooks — Eventos** (cole as URLs do n8n)
> e **Equipe → Recursos liberados** (super_admin liga o "Módulo Eventos").

---

## 1. WF Aniversário (disparo um a um)

**Gatilho:** Webhook (POST). Cole essa URL em *Configurações → Webhook de Aniversário*.

**Payload que o ClinicOS envia:**
```json
{
  "tipo": "aniversario",
  "clinica": "Renata Queiroz",
  "mensagem": "Feliz aniversário, {nome}! 🎉 Você tem 15% neste mês.",
  "total": 3,
  "pacientes": [
    { "lead_id": "uuid", "nome": "Maria Silva", "whatsapp": "5521999990000", "data_nascimento": "1990-06-19" }
  ],
  "enviado_em": "2026-06-16T18:00:00.000Z"
}
```

**Fluxo sugerido no n8n:**
1. **Webhook** (POST) → recebe o payload.
2. **Split Out / Loop** sobre `pacientes`.
3. Para cada item, **Set**: monta a mensagem trocando `{nome}` pelo `nome` do paciente
   - Expressão: `{{ $json.mensagem.replaceAll('{nome}', $json.nome) }}`
   - (se o seu n8n não tiver `replaceAll`, use `.replace(/\{nome\}/g, ...)` num Code node)
4. **HTTP Request / nó do WhatsApp** → envia via Evolution (MVP) para `whatsapp`.
5. **Wait** (ex.: 20–40s) entre cada envio (evita bloqueio do WhatsApp).

> **Meta Cloud API (futuro):** envio ativo (fora da janela de 24h) exige **template aprovado**.
> Troque o passo 4 por envio de template com a variável do nome.

---

## 2. WF Campanhas (contexto do agente + arquivamento)

As campanhas ficam na tabela **`clinic_campaigns`** do Supabase. **Não há disparo** — o
agente apenas *sabe* das promoções ativas e menciona naturalmente no atendimento.

### a) O agente lê as campanhas ativas
No fluxo do agente, antes de responder, busque as campanhas vigentes (Supabase node ou HTTP):

```sql
select titulo, oferta, descricao, data_inicio, data_fim
from clinic_campaigns
where status = 'ativa'
  and (data_inicio is null or data_inicio <= current_date)
  and (data_fim    is null or data_fim    >= current_date);
```

Injete o resultado no **prompt/contexto** do agente. Ex.:
> "Promoções ativas: Mês da Mulher — 20% em faciais (até 31/03). Mencione se fizer sentido."

### b) Arquivar automaticamente ao fim do período
**Gatilho:** Schedule (1x/dia). Atualiza no Supabase:

```sql
update clinic_campaigns
set status = 'arquivada', updated_at = now()
where status = 'ativa'
  and data_fim is not null
  and data_fim < current_date;
```

Assim a campanha sai do contexto sozinha quando vence — mas **continua no histórico**
(a clínica pode "Reutilizar" depois). Nada é excluído por aqui.

---

## Resumo do que a clínica controla no painel
- **Aniversariantes:** escreve a mensagem (com `{nome}`), confere a lista e clica "Enviar" (com confirmação).
- **Ações do mês:** cria/edita/arquiva/reutiliza/apaga campanhas. As ativas (dentro do período) entram no contexto do agente.

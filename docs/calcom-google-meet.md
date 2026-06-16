# Cal.com — Link de Google Meet em consultas online

Guia para que consultas **online** gerem automaticamente um link de reunião (Google Meet
ou Cal Video) que aparece no ClinicOS com o botão **"Entrar na reunião"**.

> Como funciona por baixo: o link **não** é gerado pelo ClinicOS. Ele é definido no
> **event-type do Cal.com** (campo *Location/Local*). Ao marcar a consulta, o Cal.com cria
> o link e envia no webhook (`videoCallData.url` / `metadata.videoCallUrl`). A edge function
> `cal-webhook` captura isso e salva em `agendamentos.link_reuniao` com `modalidade = 'online'`.

---

## Opção A — Cal Video (mais rápido, grátis, sem configurar nada)

Vídeo nativo do Cal.com. Não precisa conectar conta Google.

1. Cal.com → **Event Types** → abra o event-type da consulta online.
2. Seção **Location / Local** → **Add a location** → escolha **Cal Video**.
3. **Save**.

Pronto. Toda reserva nesse event-type já vem com link de vídeo.

---

## Opção B — Google Meet (link oficial do Meet)

Precisa conectar uma conta Google **uma vez** e usá-la como calendário de destino.

### 1. Conectar o Google Calendar no Cal.com
1. Cal.com → **Apps** (ou **Settings → Apps/Installed Apps**).
2. Procure **Google Calendar** → **Install / Conectar**.
3. Faça login com a conta Google da clínica/profissional e **autorize** o acesso ao calendário.
   - Use a conta cujo calendário deve hospedar as consultas (a que gera o Meet).

### 2. Instalar o app Google Meet
1. Ainda em **Apps**, procure **Google Meet** → **Install**.
2. O Google Meet no Cal.com **depende** do Google Calendar conectado no passo 1
   (o Meet é criado junto com o evento no Google Calendar).

### 3. Definir o calendário de destino
1. Cal.com → **Settings → Calendars** (ou **Apps → Google Calendar → configurações**).
2. Em **"Add to calendar" / "Selected calendar"**, escolha o **Google Calendar** conectado
   como destino dos eventos. (É nesse calendário que o Meet é gerado.)

### 4. Definir o Location do event-type como Google Meet
1. Cal.com → **Event Types** → abra o event-type da consulta online.
2. Seção **Location / Local** → **Add a location** → escolha **Google Meet**.
3. **Save**.

> Se "Google Meet" não aparecer na lista de Location, é porque o passo 1/2 (conectar Google
> Calendar + instalar Google Meet) não foi concluído.

---

## Boa prática: separar online de presencial

Crie event-types distintos por profissional, por exemplo:

| Event-type no Cal.com | Location | No ClinicOS |
|---|---|---|
| Consulta Online — Dra. Maria | Google Meet (ou Cal Video) | modalidade = online + botão "Entrar na reunião" |
| Consulta Presencial — Dra. Maria | Endereço / In person | modalidade = presencial |

Cada event-type tem um **ID numérico** (na URL ao editá-lo: `/event-types/123456`).
Cole esse ID no ClinicOS em **Agenda → editar agenda → "ID do Event-type"** (ou
Configurações → Agendas) para o webhook saber de qual profissional é a reserva.

---

## Como validar
1. Crie uma reserva de teste no event-type online.
2. Veja o agendamento aparecer na **Agenda** do ClinicOS como **online**.
3. Abra o agendamento → deve haver o botão **"Entrar na reunião"** com o link do Meet.
4. Se o link não vier: confira o Location do event-type e, no Google Meet, se o Google
   Calendar está conectado e selecionado como destino. Logs em
   **Supabase → Edge Functions → cal-webhook → Logs** (procure `[cal] event=...`).

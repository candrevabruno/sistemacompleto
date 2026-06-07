// WhatsApp service — suporta Evolution API e Meta Cloud API

export interface ClinicWhatsAppConfig {
  whatsapp_provider: 'evolution' | 'meta';
  evolution_server_url?: string | null;
  evolution_api_key?: string | null;
  evolution_instance_name?: string | null;
  meta_phone_number_id?: string | null;
  meta_access_token?: string | null;
}

export interface SendResult {
  whatsapp_message_id?: string;
}

export class WhatsAppService {
  constructor(private cfg: ClinicWhatsAppConfig) {}

  async sendText(phone: string, message: string): Promise<SendResult> {
    return this.cfg.whatsapp_provider === 'evolution'
      ? this.evolutionSendText(phone, message)
      : this.metaSendText(phone, message);
  }

  async sendTemplate(phone: string, templateName: string, variables: string[]): Promise<SendResult> {
    if (this.cfg.whatsapp_provider === 'evolution') {
      return this.evolutionSendText(phone, variables.join(' '));
    }
    return this.metaSendTemplate(phone, templateName, variables);
  }

  async sendDocument(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    return this.cfg.whatsapp_provider === 'evolution'
      ? this.evolutionSendDocument(phone, fileUrl, caption)
      : this.metaSendDocument(phone, fileUrl, caption);
  }

  // ── Evolution ──────────────────────────────────────────────────────

  private async evolutionSendText(phone: string, message: string): Promise<SendResult> {
    const url = `${this.cfg.evolution_server_url}/message/sendText/${this.cfg.evolution_instance_name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.cfg.evolution_api_key!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: phone,
        options: { delay: 1200 },
        textMessage: { text: message },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.key?.id };
  }

  private async evolutionSendDocument(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    const url = `${this.cfg.evolution_server_url}/message/sendMedia/${this.cfg.evolution_instance_name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.cfg.evolution_api_key!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: phone,
        options: { delay: 1200 },
        mediaMessage: { mediatype: 'document', media: fileUrl, caption: caption ?? '' },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.key?.id };
  }

  // ── Meta Cloud API ─────────────────────────────────────────────────

  private async metaSendText(phone: string, message: string): Promise<SendResult> {
    const url = `https://graph.facebook.com/v19.0/${this.cfg.meta_phone_number_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.meta_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.messages?.[0]?.id };
  }

  private async metaSendTemplate(phone: string, templateName: string, variables: string[]): Promise<SendResult> {
    const url = `https://graph.facebook.com/v19.0/${this.cfg.meta_phone_number_id}/messages`;
    const components = variables.length > 0
      ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }]
      : [];
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.meta_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: templateName, language: { code: 'pt_BR' }, components },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.messages?.[0]?.id };
  }

  private async metaSendDocument(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    const url = `https://graph.facebook.com/v19.0/${this.cfg.meta_phone_number_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.meta_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'document',
        document: { link: fileUrl, caption: caption ?? '' },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.messages?.[0]?.id };
  }
}

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
  private baseUrl: string;

  constructor(private cfg: ClinicWhatsAppConfig) {
    this.baseUrl = (cfg.evolution_server_url ?? '').replace(/\/+$/, '');
  }

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

  // Envia áudio como mensagem de voz (PTT) no WhatsApp
  async sendAudio(phone: string, base64Audio: string): Promise<SendResult> {
    return this.cfg.whatsapp_provider === 'evolution'
      ? this.evolutionSendAudio(phone, base64Audio)
      : {};
  }

  // Envia imagem, vídeo ou documento via URL pública
  async sendMedia(
    phone: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'document',
    caption?: string,
  ): Promise<SendResult> {
    return this.cfg.whatsapp_provider === 'evolution'
      ? this.evolutionSendMedia(phone, mediaUrl, mediaType, caption)
      : this.metaSendMedia(phone, mediaUrl, mediaType, caption);
  }

  // ── Evolution ──────────────────────────────────────────────────────

  private async evolutionSendText(phone: string, message: string): Promise<SendResult> {
    const url = `${this.baseUrl}/message/sendText/${this.cfg.evolution_instance_name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.cfg.evolution_api_key!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.key?.id };
  }

  private async evolutionSendAudio(phone: string, base64Audio: string): Promise<SendResult> {
    const url = `${this.baseUrl}/message/sendWhatsAppAudio/${this.cfg.evolution_instance_name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.cfg.evolution_api_key!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phone, audio: base64Audio, encoding: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution API ${res.status}: ${body}`);
    }
    const data = await res.json();
    return { whatsapp_message_id: data?.key?.id };
  }

  private async evolutionSendDocument(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    return this.evolutionSendMedia(phone, fileUrl, 'document', caption);
  }

  private async evolutionSendMedia(
    phone: string,
    mediaUrl: string,
    mediaType: string,
    caption?: string,
  ): Promise<SendResult> {
    const url = `${this.baseUrl}/message/sendMedia/${this.cfg.evolution_instance_name}`;
    // Evolution API v2 usa estrutura plana (sem wrapper mediaMessage)
    const body = JSON.stringify({
      number: phone,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption ?? '',
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.cfg.evolution_api_key!, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution API ${res.status}: ${text}`);
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
    return this.metaSendMedia(phone, fileUrl, 'document', caption);
  }

  private async metaSendMedia(
    phone: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'document',
    caption?: string,
  ): Promise<SendResult> {
    const url = `https://graph.facebook.com/v19.0/${this.cfg.meta_phone_number_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.meta_access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: mediaType,
        [mediaType]: { link: mediaUrl, caption: caption ?? '' },
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

// Helper fire-and-forget para gravar eventos em integration_log.
// Nunca lança exceção — logging nunca pode quebrar o fluxo principal.
import { createAdminClient } from './supabase-client.ts';

export async function logIntegracao(
  servico: string,
  nivel: 'info' | 'warn' | 'error',
  origem: string,
  mensagem: string,
  payload?: unknown,
): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from('integration_log').insert({
      servico,
      nivel,
      origem,
      mensagem: String(mensagem).slice(0, 500),
      payload_resumo: payload != null ? JSON.parse(JSON.stringify(payload)) : null,
    });
  } catch {
    // Silently ignore — logging must never break the main flow
  }
}

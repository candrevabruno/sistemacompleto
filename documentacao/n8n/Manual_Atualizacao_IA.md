# Guia de Atualização de Versão: Nó AI Agent (n8n)

Este documento serve como manual de referência para futuras atualizações dos nós de Inteligência Artificial nas automações da **Ellegance Clínica Integrada**.

## 1. Contexto Atual (Abril/2026)
Atualmente, todos os fluxos utilizam o nó **AI Agent na versão 1.8**. 
- **Motivo**: Estabilidade e compatibilidade garantida com o modelo `gpt-4o-mini` e com a arquitetura de ferramentas (Tools) via Planilhas Google e Postgres.
- **Risco de Atualização**: Algumas versões superiores (como a 2.2) apresentam incompatibilidades com os parâmetros de ferramentas e modelos atuais, podendo causar erros de execução nos fluxos de produção.

---

## 2. Quando Atualizar?
A atualização só é recomendada se:
1. O n8n lançar uma funcionalidade exclusiva em versões novas (ex: suporte a novos tipos de arquivos ou conexões nativas).
2. O modelo `gpt-4o-mini` parar de ser suportado pela versão 1.8 (o que não deve ocorrer tão cedo).

---

## 3. Passo a Passo para Atualização

> [!CAUTION]
> **Nunca delete o nó antigo antes de finalizar o novo.** Mantenha ambos no canvas durante o processo de migração.

1. **Criar o Novo Nó**: No painel lateral do n8n, pesquise por "AI Agent". Arraste-o para o fluxo. Ele virá na versão mais recente.
2. **Transferir a Identidade**:
   - Abra o nó antigo (v1.8).
   - Copie todo o conteúdo do campo **System Message** (Prompt de Sistema).
   - Cole no campo equivalente do novo nó.
3. **Reconectar os Sub-nós**:
   - Conecte o nó **OpenAI Chat Model** na entrada de modelo.
   - Conecte o nó **Window Buffer Memory** (ou Postgres Memory) na entrada de memória.
   - Conecte todas as **Tools** (facialTool, corporalTool, etc.) nas entradas de ferramentas.
4. **Verificar Parâmetros de Ferramentas**:
   - Em versões superiores (v2.x+), o Agente pode exigir que você defina melhor as "Descrições" das ferramentas. Se ele parar de chamar uma ferramenta, revise o campo "Description" dentro de cada nó de Tool.
5. **Teste de Fluxo**:
   - Execute o nó manualmente e envie uma mensagem de teste (ex: "Quais tratamentos faciais vocês têm?").
   - Verifique se ele aciona a ferramenta correta e retorna a resposta.

---

## 4. Troubleshooting (Resolução de Problemas)

| Erro | Causa Provável | Solução |
| :--- | :--- | :--- |
| `This model is not supported in X version` | Incompatibilidade entre a versão do nó Agent e o nó do Modelo. | Certifique-se de que o nó do "Chat Model" também foi atualizado para uma versão compatível. |
| `Agent failed to use tool` | Mudança na lógica de processamento de ferramentas nas versões 2.x/3.x. | Revise as descrições das ferramentas para serem mais explícitas. |
| Perda de contexto | Memória não conectada corretamente. | Verifique se a `Session ID` no nó de memória está usando a mesma expressão do nó original. |

---

**Responsável pela Configuração**: Antigravity AI (Google DeepMind)
**Data da última revisão**: 03/04/2026

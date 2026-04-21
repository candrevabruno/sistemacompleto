import json

def gerar_json():
    data = {
        "name": "4- Agente de Agendamento | Ellegance Clínica Integrada",
        "nodes": [
            {
                "parameters": {
                    "jsCode": "const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];\nconst now = new Date();\nconst pad = (n) => String(n).padStart(2, '0');\n\nlet result = `Hoje é ${days[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${String(now.getFullYear()).slice(2)} às ${pad(now.getHours())}:${pad(now.getMinutes())}\\n`;\n\nfor (let i = 1; i <= 6; i++) {\n  const future = new Date(now);\n  future.setDate(now.getDate() + i);\n\n  let label = '';\n\n  if (i === 1) {\n    label = `Amanhã é ${days[future.getDay()]} ${pad(future.getDate())}/${pad(future.getMonth()+1)}/${String(future.getFullYear()).slice(2)}`;\n  } else if (i === 2) {\n    label = `Depois de amanhã é ${days[future.getDay()]} ${pad(future.getDate())}/${pad(future.getMonth()+1)}/${String(future.getFullYear()).slice(2)}`;\n  } else {\n    label = `A próxima ${days[future.getDay()]} será dia ${pad(future.getDate())}/${pad(future.getMonth()+1)}/${String(future.getFullYear()).slice(2)}`;\n  }\n\n  result += `${label}\\n`;\n}\n\nreturn [\n  {\n    json: {\n      resultado: result.trim()\n    }\n  }\n];\n"
                },
                "id": "f2b3722f-a04d-4259-bb88-8febe872232b",
                "name": "proximos_dias",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [1056, 464]
            },
            {
                "parameters": {
                    "assignments": {
                        "assignments": [
                            {"id": "f6597956", "name": "lead_mensagem", "value": "={{ $('agendar').item.json.lead_mensagem }}", "type": "string"},
                            {"id": "14ffa419", "name": "whastapp_lead", "value": "={{ $('agendar').item.json.whastapp_lead }}", "type": "string"},
                            {"id": "b55100a5", "name": "proximos_dias", "value": "={{ $json.resultado }}", "type": "string"},
                            {"id": "0ff2ae8c", "name": "lead_id", "value": "={{ $('puxar_lead').item.json.id }}", "type": "string"},
                            {"id": "fab7581a", "name": "id_agendamento", "value": "={{ $('puxar_lead').item.json.id_agendamento }}", "type": "string"},
                            {"id": "5068c363", "name": "id_conta_chatwoot", "value": "={{ $('puxar_lead').item.json.id_conta_chatwoot }}", "type": "string"},
                            {"id": "9531f8bb", "name": "id_conversa_chatwoot", "value": "={{ $('puxar_lead').item.json.id_conversa_chatwoot }}", "type": "string"},
                            {"id": "f9826e7d", "name": "url_chatwoot", "value": "={{ $('agendar').item.json.url_chatwoot }}", "type": "string"}
                        ]
                    }
                },
                "id": "7a715099-70db-4b13-89ad-585345f154cb",
                "name": "setarInfo",
                "type": "n8n-nodes-base.set",
                "typeVersion": 3.4,
                "position": [1424, 464]
            },
            {
                "parameters": {
                    "workflowInputs": {
                        "values": [{"name": "lead_mensagem"}, {"name": "whastapp_lead"}, {"name": "url_chatwoot"}]
                    }
                },
                "id": "580a2296-e954-4239-a7ad-d1b6ae9508bf",
                "name": "agendar",
                "type": "n8n-nodes-base.executeWorkflowTrigger",
                "typeVersion": 1.1,
                "position": [288, 464]
            },
            {
                "parameters": {
                    "sessionIdType": "customKey",
                    "sessionKey": "={{ $json.whastapp_lead }}",
                    "contextWindowLength": 40
                },
                "id": "2634a930-2f89-4e15-9149-c367281dcd6b",
                "name": "memoria1",
                "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
                "typeVersion": 1.3,
                "position": [1984, 592],
                "credentials": {"postgres": {"id": "Ge2KXJWVeg4UkmVH", "name": "Postgres - Supabase - Sistema Completo"}}
            },
            {
                "parameters": {
                    "model": "gpt-4o-mini",
                    "options": {}
                },
                "id": "a9690b8e-9e36-4537-ada0-df50c44cfa56",
                "name": "OpenAI Chat Model",
                "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
                "typeVersion": 1,
                "position": [1792, 592],
                "credentials": {"openAiApi": {"id": "T7IHUAGaXa4OG4Rq", "name": "OpenAi - Heroic Leap"}}
            },
            {
                "parameters": {
                    "operation": "get",
                    "tableId": "leads",
                    "filters": {
                        "conditions": [{"keyName": "whatsapp_lead", "keyValue": "={{ $json.whastapp_lead }}"}]
                    }
                },
                "id": "3e9b45a6-65c5-43fc-a74c-51f9ef54a703",
                "name": "puxar_lead",
                "type": "n8n-nodes-base.supabase",
                "typeVersion": 1,
                "position": [688, 464],
                "credentials": {"supabaseApi": {"id": "ZLy7XAufqOJYEixr", "name": "Supabase - Sistema Completo"}}
            },
            {
                "parameters": {
                    "promptType": "define",
                    "text": "={{ $json.lead_mensagem }}",
                    "options": {
                        "systemMessage": "=# IDENTIDADE\n\n-  Você é um **agente interno de roteamento de agendamentos** da **Ellegance Clínica Integrada**.  \n-  Seu papel é identificar o destino correto.\n\n# SUA FUNÇÃO\n-   Analise e encaminhe para:\n    -   **Fernanda (fernandaTool)** -> faciais\n    -   **Ângela (angelaTool)** -> injetáveis/skincare\n    -   **Kelly (kellyTool)** -> corporais\n\n# REGRAS\n-   Datas: **\"terça-feira, dia 12/03, às 15h\"**.\n\n## CONTEXTO\n{{ $json.proximos_dias }}"
                    }
                },
                "id": "1c8f2b73-49bd-4033-a274-c2ccb34fc996",
                "name": "AI Agent1",
                "type": "@n8n/n8n-nodes-langchain.agent",
                "typeVersion": 1.8,
                "position": [1952, 352]
            },
            {
                "parameters": {
                    "description": "Ferramenta Angela",
                    "workflowId": {"__rl": True, "value": "HMbNhxPyG242ycJs", "mode": "id"},
                    "workflowInputs": {"mappingMode": "defineBelow", "value": {"id_agenda": "ff6e46fd-8743-4de7-a906-f7fe31642a45", "whatsapp_lead": "={{ $json.whastapp_lead }}", "id_agendamento": "={{ $json.id_agendamento }}", "id_conta_chatwoot": "={{ $json.id_conta_chatwoot }}", "id_conversa_chatwoot": "={{ $json.id_conversa_chatwoot }}", "url_chatwoot": "={{ $json.url_chatwoot }}", "lead_id": "={{ $json.lead_id }}"}}
                },
                "id": "05f31bf8-860e-4a75-83bd-a54ca29e1e25",
                "name": "angelaTool",
                "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
                "typeVersion": 2.2,
                "position": [2224, 880]
            },
            {
                "parameters": {
                    "description": "Ferramenta Fernanda",
                    "workflowId": {"__rl": True, "value": "4cvyflJwrChqLaQa", "mode": "id"},
                    "workflowInputs": {"mappingMode": "defineBelow", "value": {"id_agenda": "2ffede81-3ed4-42e3-bae3-3a30959611f3", "whatsapp_lead": "={{ $json.whastapp_lead }}", "id_agendamento": "={{ $json.id_agendamento }}", "id_conta_chatwoot": "={{ $json.id_conta_chatwoot }}", "id_conversa_chatwoot": "={{ $json.id_conversa_chatwoot }}", "url_chatwoot": "={{ $json.url_chatwoot }}", "lead_id": "={{ $json.lead_id }}"}}
                },
                "id": "892abbea-e84e-4fcd-81be-602f6bb76f93",
                "name": "fernandaTool",
                "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
                "typeVersion": 2.2,
                "position": [2368, 880]
            },
            {
                "parameters": {
                    "description": "Ferramenta Kelly",
                    "workflowId": {"__rl": True, "value": "tfc5HZz7ygXkUWWB", "mode": "id"},
                    "workflowInputs": {"mappingMode": "defineBelow", "value": {"id_agenda": "b9fa4993-d62c-4780-b9cc-b952caf784e0", "whatsapp_lead": "={{ $json.whastapp_lead }}", "id_agendamento": "={{ $json.id_agendamento }}", "id_conta_chatwoot": "={{ $json.id_conta_chatwoot }}", "id_conversa_chatwoot": "={{ $json.id_conversa_chatwoot }}", "url_chatwoot": "={{ $json.url_chatwoot }}", "lead_id": "={{ $json.lead_id }}"}}
                },
                "id": "314c3296-2508-4781-a19a-7fbbfb73bbf4",
                "name": "kellyTool",
                "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
                "typeVersion": 2.2,
                "position": [2512, 880]
            }
        ],
        "connections": {
            "proximos_dias": {"main": [[{"node": "setarInfo", "type": "main", "index": 0}]]},
            "setarInfo": {"main": [[{"node": "AI Agent1", "type": "main", "index": 0}]]},
            "agendar": {"main": [[{"node": "puxar_lead", "type": "main", "index": 0}]]},
            "memoria1": {"ai_memory": [[{"node": "AI Agent1", "type": "ai_memory", "index": 0}]]},
            "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent1", "type": "ai_languageModel", "index": 0}]]},
            "puxar_lead": {"main": [[{"node": "proximos_dias", "type": "main", "index": 0}]]},
            "AI Agent1": {"main": [[{"node": "Response", "type": "main", "index": 0}]]},
            "angelaTool": {"ai_tool": [[{"node": "AI Agent1", "type": "ai_tool", "index": 0}]]},
            "fernandaTool": {"ai_tool": [[{"node": "AI Agent1", "type": "ai_tool", "index": 0}]]},
            "kellyTool": {"ai_tool": [[{"node": "AI Agent1", "type": "ai_tool", "index": 0}]]}
        },
        "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo"},
        "meta": {"instanceId": "cd3f555560da593715f2409944039c2dd529d28b002c9eefb22eeac5fd695ee6"}
    }

    path = "/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes/Agendamento/4- Agente de Agendamento _ Ellegance Clínica Integrada.json"
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Validação imediata
    try:
        with open(path, 'r', encoding='utf-8') as f:
            json.load(f)
        print("OK: JSON gerado e validado com sucesso!")
    except Exception as e:
        print(f"ERRO: Falha na validação final: {e}")

if __name__ == "__main__":
    gerar_json()

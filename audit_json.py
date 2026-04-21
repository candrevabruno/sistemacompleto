import json
import os
import glob

def audit_jsons():
    base_dir = '/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes'
    json_files = glob.glob(f'{base_dir}/**/*.json', recursive=True)
    report = ""
    
    for file_path in sorted(json_files):
        report += f"\n{'='*60}\nFILE: {os.path.relpath(file_path, base_dir)}\n{'='*60}\n"
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            report += f"Error loading JSON: {e}\n"
            continue
            
        nodes = data.get('nodes', [])
        for node in nodes:
            node_type = node.get('type', '')
            node_name = node.get('name', 'Unknown')
            params = node.get('parameters', {})
            
            is_db_node = False
            msg = ""
            if 'supabase' in node_type.lower():
                is_db_node = True
                msg += f"[SUPABASE] Node: {node_name}\n"
                msg += f"  - Operation: {params.get('operation', 'N/A')}\n"
                msg += f"  - Table: {params.get('table', 'N/A')}\n"
                if 'matchFields' in params:
                    msg += f"  - Match Fields: {params['matchFields']}\n"
                if 'dataFields' in params:
                    msg += f"  - Data Fields: {params['dataFields']}\n"
                if 'dataFieldsUi' in params:
                    msg += f"  - Data Fields UI: {params['dataFieldsUi']}\n"
            
            elif 'postgres' in node_type.lower():
                is_db_node = True
                msg += f"[POSTGRES] Node: {node_name}\n"
                op = params.get('operation', 'executeQuery')
                msg += f"  - Operation: {op}\n"
                if op == 'executeQuery':
                    # sometimes the query is nested inside options
                    query = params.get('query', '')
                    if not query and 'options' in params and 'query' in params['options']:
                        query = params['options']['query']
                    msg += f"  - Query:\n    {query.strip() if isinstance(query, str) else query}\n"
                else:
                    msg += f"  - Table: {params.get('schema', 'public')}.{params.get('table', 'N/A')}\n"
                    msg += f"  - Columns: {params.get('columns', 'N/A')}\n"
            
            elif 'httprequest' in node_type.lower():
                url = str(params.get('url', ''))
                if 'supabase' in url.lower() or 'rest/v1' in url.lower():
                    is_db_node = True
                    msg += f"[HTTP API] Node: {node_name}\n"
                    msg += f"  - Method: {params.get('method', 'GET')}\n"
                    msg += f"  - URL: {url}\n"
            
            if is_db_node:
                report += msg + "-"*30 + "\n"

    print(report)

if __name__ == '__main__':
    audit_jsons()

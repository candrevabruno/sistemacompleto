import json
import glob
import os

def fix_keys():
    base_dir = '/Users/elenmendes/Desktop/Heroic Leap - Sistema Completo/automacoes'
    json_files = glob.glob(f'{base_dir}/**/*.json', recursive=True)
    
    old_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzYmNxa2hiaG1kaWVibG9nbnR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzYwOTgsImV4cCI6MjA5MDA1MjA5OH0.gra_-tYNK1jpwi782rVzMFapO-5-nDchKzxYvOU5ktQ'
    new_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbnhzaGRmc3N0YnV2eGlxbWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODgxMzksImV4cCI6MjA5MDY2NDEzOX0.s2s9uXjq6r2xDfqJecijgY6JPGloEFAGsmB9xEUJqCI'
    
    count = 0
    for file_path in json_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if old_key in content:
            new_content = content.replace(old_key, new_key)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed keys in: {os.path.basename(file_path)}")
            count += 1
            
    print(f"Total files updated: {count}")

if __name__ == '__main__':
    fix_keys()

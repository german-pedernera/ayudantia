import os
import re

directory = 'c:/Users/HP/OneDrive/Escritorio/ayudantia-main/src/components'
pattern = re.compile(r'^\s*>\s*$', re.MULTILINE)

for filename in os.listdir(directory):
    if filename.endswith('.jsx'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove lines that are just '>'
        new_content = pattern.sub('', content)
        
        # Also clean up double newlines if they were created
        new_content = re.sub(r'\n\n\n+', '\n\n', new_content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Cleaned {filename}")

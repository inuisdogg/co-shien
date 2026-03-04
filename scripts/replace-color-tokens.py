#!/usr/bin/env python3
"""
Batch replace hardcoded brand hex colors with semantic Tailwind tokens.
Run from project root: python3 scripts/replace-color-tokens.py
"""
import os

replacements = [
    # Primary colors - order matters (longer/more-specific patterns first)
    ('focus:border-[#00c4cc]', 'focus:border-primary'),
    ('focus:ring-[#00c4cc]', 'focus:ring-primary'),
    ('hover:bg-[#00b0b8]', 'hover:bg-primary-dark'),
    ('hover:text-[#00b0b8]', 'hover:text-primary-dark'),
    ('bg-[#00c4cc]/20', 'bg-primary/20'),
    ('bg-[#00c4cc]/10', 'bg-primary/10'),
    ('bg-[#00c4cc]/5', 'bg-primary/5'),
    ('bg-[#00c4cc]', 'bg-primary'),
    ('bg-[#00b0b8]', 'bg-primary-dark'),
    ('text-[#00c4cc]', 'text-primary'),
    ('text-[#00b0b8]', 'text-primary-dark'),
    ('border-[#00c4cc]', 'border-primary'),
    ('border-[#00b0b8]', 'border-primary-dark'),
    ('ring-[#00c4cc]', 'ring-primary'),
    # Personal colors
    ('bg-[#818CF8]/10', 'bg-personal/10'),
    ('bg-[#818CF8]', 'bg-personal'),
    ('bg-[#6366F1]', 'bg-personal-dark'),
    ('text-[#818CF8]', 'text-personal'),
    ('text-[#6366F1]', 'text-personal-dark'),
    ('border-[#818CF8]', 'border-personal'),
    ('border-[#6366F1]', 'border-personal-dark'),
    # Client colors
    ('hover:bg-[#ED8936]', 'hover:bg-client-dark'),
    ('hover:text-[#ED8936]', 'hover:text-client-dark'),
    ('bg-[#F6AD55]', 'bg-client'),
    ('bg-[#ED8936]', 'bg-client-dark'),
    ('text-[#F6AD55]', 'text-client'),
    ('text-[#ED8936]', 'text-client-dark'),
    ('border-[#F6AD55]', 'border-client'),
    ('bg-[#FFF8F0]', 'bg-client-light'),
]

count = 0
for root, dirs, files in os.walk('src'):
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.next']]
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r') as fh:
                content = fh.read()
            original = content
            for old, new in replacements:
                content = content.replace(old, new)
            if content != original:
                with open(path, 'w') as fh:
                    fh.write(content)
                count += 1
                print(f'Updated: {path}')

print(f'\nTotal files updated: {count}')

import os
import re

# Read the list of files to un-skip
pending_tests_file = "/home/codedex/.gemini/antigravity/brain/e5acf0a0-1bed-4bd6-b3e3-bd1429272ab9/pending_tests.txt"
with open(pending_tests_file, "r") as f:
    files = [line.strip() for line in f if line.strip()]

for file_path in files:
    if not os.path.exists(file_path):
        continue

    print(f"Un-skipping: {file_path}")
    with open(file_path, "r") as f:
        lines = f.readlines()

    new_lines = []
    
    # Check for line comments block
    line_comment_count = sum(1 for line in lines if line.strip().startswith("//"))
    use_line_comment_removal = line_comment_count > 5

    for line in lines:
        # 1. Skip the test.skip/describe.skip line
        if 'UPSTREAM PENDING SYNC' in line and ('.skip' in line):
             continue
        
        # 2. Skip the placeholder comment
        if 'ORIGINAL TEST CODE COMMENTED OUT' in line:
            continue

        # 3. Handle block comment markers
        trimmed = line.strip()
        if trimmed == "/*" or trimmed == "*/":
            continue
            
        # 4. Handle line comments
        if use_line_comment_removal and trimmed.startswith("//"):
            # Remove the comment marker
            if line.startswith("// "):
                new_lines.append(line[3:])
            elif line.startswith("//"):
                new_lines.append(line[2:])
            else:
                new_lines.append(line)
            continue

        new_lines.append(line)

    content = "".join(new_lines).strip() + "\n"
    
    # 5. Type Cleanup: Remove duplicate vitest test import if describe/expect etc are present
    # Case: import { test } from 'vitest'; plus import { describe, ... } from 'vitest';
    if ('describe' in content or 'it' in content or 'expect' in content) and ('import { test } from "vitest"' in content or "import { test } from 'vitest'" in content):
        content = re.sub(r'import { test } from ["\']vitest["\'];?\n?', '', content)

    with open(file_path, "w") as f:
        f.write(content)

print(f"Processed {len(files)} files.")

import os
import re

files_to_fix = [
    "src/services/campaignService.test.ts",
    "src/services/analytics.test.ts",
    "src/services/templateService.test.ts",
    "src/services/AgentService.test.ts",
    "src/services/FirebaseService.path.test.ts",
    "src/services/FirebaseService.test.ts",
    "src/services/FirebaseService.hierarchy.test.ts",
    "src/services/contactService.test.ts"
]

for file_path in files_to_fix:
    if not os.path.exists(file_path):
        print(f"Skipping missing file: {file_path}")
        continue
    
    print(f"Fixing imports in: {file_path}")
    with open(file_path, "r") as f:
        content = f.read()
    
    # Replace relative imports
    content = content.replace("./FirebaseService.js", "@/persistence/firebase.js")
    
    # Some might use double quotes or single quotes
    content = content.replace('./FirebaseService.js', '@/persistence/firebase.js')
    
    # Also handle the class name if it was moved (it's in persistence/firebase.ts now)
    # Most of these files already import the class.
    
    with open(file_path, "w") as f:
        f.write(content)

print("Finished fixing FirebaseService imports.")

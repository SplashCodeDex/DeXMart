import os

file_path = "src/ingress/ingress-service.fusion.test.ts"

if os.path.exists(file_path):
    with open(file_path, "r") as f:
        content = f.read()
    
    # Fix relative imports from ingress to services
    content = content.replace("from './deduplicationService.js'", "from '../services/deduplicationService.js'")
    content = content.replace("from './AgentService.js'", "from '../services/AgentService.js'")
    content = content.replace("from './ChannelService.js'", "from '../services/ChannelService.js'")
    content = content.replace("from './tenantConfigService.js'", "from '../services/tenantConfigService.js'")
    content = content.replace("from './automationService.js'", "from '../services/automationService.js'")
    content = content.replace("from './flowService.js'", "from '../services/flowService.js'")
    content = content.replace("from './analytics.js'", "from '../services/analytics.js'")
    
    # Also fix dynamic imports inside tests
    content = content.replace("import('./deduplicationService.js')", "import('../services/deduplicationService.js')")
    content = content.replace("import('./AgentService.js')", "import('../services/AgentService.js')")
    content = content.replace("import('./ChannelService.js')", "import('../services/ChannelService.js')")
    
    with open(file_path, "w") as f:
        f.write(content)
    print(f"Fixed imports in {file_path}")
else:
    print(f"File not found: {file_path}")

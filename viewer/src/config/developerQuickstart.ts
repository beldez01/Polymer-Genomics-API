/** Commands checked against the SDK and MCP package entry points. */
export const PYTHON_INSTALL = 'pip install polymer-genomics';
export const MCP_CONFIG = JSON.stringify({
  mcpServers: {
    'polymer-genomics': {
      command: 'uvx',
      args: ['polymer-genomics-mcp'],
      env: { POLYMER_API_KEY: 'YOUR_API_KEY' },
    },
  },
}, null, 2);
export const PYTHON_QUICKSTART = `import os
from polymer_genomics import PolymerClient

with PolymerClient(api_key=os.environ["POLYMER_API_KEY"]) as client:
    region = client.region(
        "hg38", "chr17:7668421-7687490", layers=["cpg_sites"]
    )
    print(region)`;
export const REST_QUICKSTART = `curl 'https://api.polymerbio.org/v1/regions/hg38/chr17:7668421-7687490?layers=cpg_sites' \\
  -H "X-API-Key: $POLYMER_API_KEY"`;

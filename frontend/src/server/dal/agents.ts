/**
 * Data Access Layer - Agents
 *
 * Server-side operations for agent documents.
 */

/**
 * Get agents for a tenant
 */
export async function getTenantAgents(_tenantId: string): Promise<never[]> {
  // Implementation will query tenants/{tenantId}/agents collection
  return [];
}

/**
 * Get agent by ID
 */
export async function getAgentById(_tenantId: string, _agentId: string): Promise<null> {
  // Implementation will fetch specific agent document
  return null;
}

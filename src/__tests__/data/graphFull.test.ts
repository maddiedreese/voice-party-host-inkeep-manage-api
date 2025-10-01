// @ts-nocheck - TODO: Update tests for new scoped architecture where tools and dataComponents are not returned in agent objects
import {
  createFullGraphServerSide,
  deleteFullGraph,
  type FullGraphDefinition,
  getFullGraph,
  updateFullGraphServerSide,
} from '@inkeep/agents-core';
import { nanoid } from 'nanoid';
import { describe, expect, it, vi } from 'vitest';
import dbClient from '../../data/db/dbClient';
import { ensureTestProject } from '../utils/testProject';
import { createTestTenantId } from '../utils/testTenant';

// Mock the logger to reduce noise in tests
vi.mock('../../logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('Graph Full Service Layer - Unit Tests', () => {
  // Helper function to create test agent data
  const createTestAgentData = (id: string, suffix = '') => ({
    id,
    name: `Test Agent${suffix}`,
    description: `Test agent description${suffix}`,
    prompt: `You are a helpful assistant${suffix}.`,
    canDelegateTo: [] as string[],
    canTransferTo: [] as string[],
    dataComponents: [] as string[],
    artifactComponents: [] as string[],
    tools: [] as string[], // Array of tool IDs, not tool objects
    canUse: [] as { toolId: string; toolSelection?: string[] | null }[], // Required field for internal agents
    type: 'internal' as const,
  });

  // Helper function to create test tool data
  // const createTestToolData = (id: string, suffix = '') => ({
  //   id,
  //   name: `Test Tool${suffix}`,
  //   config: {
  //     type: 'mcp',
  //     mcp: {
  //       server: {
  //         url: `http://localhost:300${suffix || '1'}`,
  //       },
  //     },
  //   },
  //   status: 'unknown' as const,
  //   capabilities: { tools: true },
  //   lastHealthCheck: new Date().toISOString(),
  //   availableTools: [
  //     {
  //       name: `testTool${suffix}`,
  //       description: `Test tool function${suffix}`,
  //     },
  //   ],
  // });

  // Helper function to create test data component data
  // const createTestDataComponentData = (id: string, suffix = '') => ({
  //   id,
  //   name: `Test DataComponent${suffix}`,
  //   description: `Test data component description${suffix}`,
  //   props: {
  //     type: 'object',
  //     properties: {
  //       items: {
  //         type: 'array',
  //         items: { type: 'string' },
  //         description: `Test items array${suffix}`,
  //       },
  //       title: {
  //         type: 'string',
  //         description: `Test title${suffix}`,
  //       },
  //     },
  //     required: ['items'],
  //   },
  // });

  // Helper function to create test external agent data
  const createTestExternalAgentData = (id: string, suffix = '') => ({
    id,
    name: `External Agent${suffix}`,
    description: `External agent description${suffix}`,
    baseUrl: `https://external-service${suffix}.example.com`,
    type: 'external' as const,
  });

  // Helper function to create test context config data
  const createTestContextConfigData = (id: string, suffix = '') => ({
    id,
    name: `Context Config${suffix}`,
    description: `Test context configuration${suffix}`,
    contextSources: [
      {
        type: 'static',
        content: `Static context content${suffix}`,
      },
    ],
  });

  // Helper function to create full graph data
  const createFullGraphData = (
    graphId?: string,
    options: {
      includeDataComponents?: boolean;
      includeExternalAgents?: boolean;
      includeContextConfig?: boolean;
    } = {}
  ): FullGraphDefinition => {
    const id = graphId || nanoid();
    const agentId1 = `agent-${id}-1`;
    const agentId2 = `agent-${id}-2`;
    const externalAgentId = `external-agent-${id}`;
    const toolId1 = `tool-${id}-1`;
    const dataComponentId1 = `datacomponent-${id}-1`;
    const contextConfigId = `context-${id}`;

    const agent1 = createTestAgentData(agentId1, ' Router');
    const agent2 = createTestAgentData(agentId2, ' Specialist');
    // const tool1 = createTestToolData(toolId1, '1');

    // Set up relationships
    agent1.canTransferTo = [agentId2];
    agent1.canDelegateTo = [agentId2];

    // Add tool ID to agent (not the tool object)
    agent1.tools = [toolId1];

    // Add dataComponent if requested
    if (options.includeDataComponents) {
      agent1.dataComponents = [dataComponentId1];
    }

    // Add external agent relationships if requested
    if (options.includeExternalAgents) {
      agent1.canDelegateTo.push(externalAgentId);
    }

    const graphData: FullGraphDefinition = {
      id,
      name: `Test Graph ${id}`,
      description: `Test graph description for ${id}`,
      defaultAgentId: agentId1,
      agents: {
        [agentId1]: agent1,
        [agentId2]: agent2,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add external agents if requested
    if (options.includeExternalAgents) {
      graphData.agents[externalAgentId] = createTestExternalAgentData(externalAgentId, '');
    }

    // Note: DataComponents are now project-scoped and should be created separately
    // dataComponents are no longer part of the graph definition

    // Add context config if requested
    if (options.includeContextConfig) {
      graphData.contextConfig = createTestContextConfigData(contextConfigId, '');
    }

    return graphData;
  };

  describe('createFullGraph', () => {
    it('should create a basic graph with agents only', async () => {
      const tenantId = createTestTenantId('service-create-basic');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      // Create a simple graph with just agents (no project-scoped resources)
      const graphData: FullGraphDefinition = {
        id: `test-graph-${nanoid()}`,
        name: 'Basic Test Graph',
        description: 'A basic test graph with agents only',
        defaultAgentId: 'agent-1',
        agents: {
          'agent-1': {
            id: 'agent-1',
            name: 'Test Agent 1',
            description: 'Test agent description',
            prompt: 'You are a helpful assistant.',
            tools: [], // Empty tools array - no tools needed for basic test
            canUse: [],
            type: 'internal' as const,
          },
          'agent-2': {
            id: 'agent-2',
            name: 'Test Agent 2',
            description: 'Test agent description',
            prompt: 'You are a helpful assistant.',
            tools: [],
            canUse: [],
            canTransferTo: ['agent-1'],
            type: 'internal' as const,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);
      expect(result.name).toBe(graphData.name);
      expect(result.defaultAgentId).toBe(graphData.defaultAgentId);
      expect(Object.keys(result.agents)).toHaveLength(2);

      // Verify agent relationships were created
      // const agent2 = result.agents['agent-2'];
      // expect(agent2.canTransferTo).toContain('agent-1');
    });

    it('should create a complete graph with all entities', async () => {
      // In new architecture: tools, dataComponents, artifactComponents are project-scoped
      // Graph only contains agents and their relationships
      const tenantId = createTestTenantId('service-create');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);
      expect(result.name).toBe(graphData.name);
      expect(result.defaultAgentId).toBe(graphData.defaultAgentId);
      expect(Object.keys(result.agents)).toHaveLength(2);

      // Verify agent relationships were created
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        expect(defaultAgent).toBeDefined();
        if ('canTransferTo' in defaultAgent) {
          expect(defaultAgent.canTransferTo).toContain(Object.keys(graphData.agents)[1]);
        }
        if ('canDelegateTo' in defaultAgent) {
          expect(defaultAgent.canDelegateTo).toContain(Object.keys(graphData.agents)[1]);
        }
        // Verify tool IDs are preserved (but actual tools are project-scoped)
        if ('tools' in defaultAgent) {
          expect(defaultAgent.tools).toBeDefined();
          expect(Array.isArray(defaultAgent.tools)).toBe(true);
        }
      }
    });

    it('should handle graph with single agent and no relationships', async () => {
      const tenantId = createTestTenantId('service-single-agent');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const agentId = nanoid();
      const graphId = nanoid();

      const graphData: FullGraphDefinition = {
        id: graphId,
        name: 'Single Agent Graph',
        description: 'Graph with single agent',
        defaultAgentId: agentId,
        agents: {
          [agentId]: {
            ...createTestAgentData(agentId, ' Standalone'),
            name: 'Single Agent',
            description: 'A standalone agent',
          },
        },
        // Note: tools are now project-scoped and not part of the graph definition
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphId);
      expect(Object.keys(result.agents)).toHaveLength(1);
      // Verify agent relationships
      const agent = result.agents[agentId];
      if ('canTransferTo' in agent) {
        expect(agent.canTransferTo).toHaveLength(0);
      }
      if ('canDelegateTo' in agent) {
        expect(agent.canDelegateTo).toHaveLength(0);
      }
      if ('tools' in agent) {
        expect(agent.tools).toHaveLength(0);
      }
    });

    it('should handle upsert behavior for existing graph', async () => {
      const tenantId = createTestTenantId('service-upsert');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first time
      const firstResult = await createFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        graphData
      );
      expect(firstResult.id).toBe(graphData.id);

      // Modify the graph data
      const updatedGraphData = {
        ...graphData,
        name: 'Updated Graph Name',
      };

      // Create again (should update)
      const secondResult = await createFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );
      expect(secondResult.id).toBe(graphData.id);
      expect(secondResult.name).toBe('Updated Graph Name');
    });

    it('should create a graph with dataComponent references', async () => {
      const tenantId = createTestTenantId('service-create-datacomponents');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData(undefined, { includeDataComponents: true });

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);

      // Verify agent has dataComponent IDs (actual components are project-scoped)
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        expect(defaultAgent).toBeDefined();
        if ('dataComponents' in defaultAgent) {
          expect(defaultAgent.dataComponents).toBeDefined();
          // Note: In the new scoped architecture, dataComponents are not returned in agent objects
          expect(defaultAgent.dataComponents).toHaveLength(0);
        }
      }
    });

    it('should create a graph with external agents', async () => {
      const tenantId = createTestTenantId('service-create-external');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData(undefined, { includeExternalAgents: true });

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);

      // Find external agent
      const externalAgent = Object.values(result.agents).find((agent) =>
        agent.baseUrl?.includes('external-service')
      );
      expect(externalAgent).toBeDefined();
      expect(externalAgent?.baseUrl).toContain('external-service');

      // Verify internal agent can hand off to external agent
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        if ('canDelegateTo' in defaultAgent) {
          expect(defaultAgent.canDelegateTo).toContain(externalAgent?.id);
        }
      }
    });

    it('should create a graph with context config', async () => {
      const tenantId = createTestTenantId('service-create-context');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData(undefined, { includeContextConfig: true });

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);
      expect(result.contextConfig).toBeDefined();
    });

    it('should create a graph with all components (comprehensive test)', async () => {
      const tenantId = createTestTenantId('service-create-comprehensive');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData(undefined, {
        includeDataComponents: true,
        includeExternalAgents: true,
        includeContextConfig: true,
      });

      const result = await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);

      // Verify all agents exist
      expect(Object.keys(result.agents)).toHaveLength(3); // 2 internal + 1 external
      expect(result.contextConfig).toBeDefined();

      // Verify agent relationships and references
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        // Note: In the new scoped architecture, tools and dataComponents are not returned in agent objects
        // but relationship properties (canTransferTo, canDelegateTo) are still returned
        if ('tools' in defaultAgent) {
          expect(defaultAgent.tools).toHaveLength(0);
        }
        if ('dataComponents' in defaultAgent) {
          expect(defaultAgent.dataComponents).toHaveLength(0);
        }
        if ('canTransferTo' in defaultAgent) {
          expect(defaultAgent.canTransferTo).toHaveLength(1);
        }
        if ('canDelegateTo' in defaultAgent) {
          expect(defaultAgent.canDelegateTo).toHaveLength(2);
        }
      }

      // Verify external agent exists
      const externalAgent = Object.values(result.agents).find((agent) =>
        agent.baseUrl?.includes('external-service')
      );
      expect(externalAgent).toBeDefined();
    });
  });

  describe('getFullGraph', () => {
    it.skip('should retrieve an existing graph', async () => {
      const tenantId = createTestTenantId('service-get');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Retrieve it
      const result = await getFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(graphData.id);
      expect(result?.name).toBe(graphData.name);
      if (result) {
        expect(Object.keys(result.agents)).toHaveLength(2);
      }
    });

    it.skip('should return null for non-existent graph', async () => {
      const tenantId = createTestTenantId('service-get-nonexistent');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const nonExistentId = nanoid();

      const result = await getFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: nonExistentId },
      });

      expect(result).toBeNull();
    });
  });

  describe('updateFullGraph', () => {
    it.skip('should update an existing graph', async () => {
      // TODO: Update this test to work with new scoped architecture
      const tenantId = createTestTenantId('service-update');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Update it
      const updatedGraphData = {
        ...graphData,
        name: 'Updated Graph Name',
        description: 'Updated description',
      };

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);
      expect(result.name).toBe('Updated Graph Name');
      expect(result.description).toBe('Updated description');
      expect(Object.keys(result.agents)).toHaveLength(2);
    });

    it.skip('should create a new graph if it does not exist', async () => {
      const tenantId = createTestTenantId('service-update-create');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Update non-existent graph (should create)
      const result = await updateFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      expect(result).toBeDefined();
      expect(result.id).toBe(graphData.id);
      expect(result.name).toBe(graphData.name);
      expect(Object.keys(result.agents)).toHaveLength(2);
    });

    // NOTE: ID mismatch validation may have changed in the new implementation
    it.skip('should throw error for ID mismatch', async () => {
      const tenantId = createTestTenantId('service-update-mismatch');
      const projectId = 'default';

      const graphData = createFullGraphData();
      const differentId = nanoid();

      await expect(
        updateFullGraphServerSide(dbClient)(
          { tenantId, projectId },
          { ...graphData, id: differentId }
        )
      ).rejects.toThrow('Graph ID mismatch');
    });

    it.skip('should handle adding new agents in update', async () => {
      const tenantId = createTestTenantId('service-update-add-agents');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Add a new agent
      const newAgentId = `agent-${graphData.id}-3`;
      const updatedGraphData = {
        ...graphData,
        agents: {
          ...graphData.agents,
          [newAgentId]: createTestAgentData(newAgentId, ' New Agent'),
        },
      };

      // Update existing agent to have relationship with new agent
      // Note: canTransferTo is part of the agent definition in the input, not the returned result
      updatedGraphData.agents[graphData.defaultAgentId].canTransferTo.push(newAgentId);

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();
      expect(Object.keys(result.agents)).toHaveLength(3);
      expect(result.agents).toHaveProperty(newAgentId);
      // Verify the relationship was created
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        if ('canTransferTo' in defaultAgent) {
          expect(defaultAgent.canTransferTo).toContain(newAgentId);
        }
      }
    });

    it.skip('should update graph with dataComponents', async () => {
      const tenantId = createTestTenantId('service-update-datacomponents');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first (without dataComponents)
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Update to include dataComponents
      const updatedGraphData = createFullGraphData(graphData.id, {
        includeDataComponents: true,
      });

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();
      // Note: dataComponents are now project-scoped and not part of the graph definition
      // The agent.dataComponents array contains dataComponent IDs, but the actual dataComponent objects are at the project level

      // Verify agent-dataComponent relationship
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        if ('dataComponents' in defaultAgent) {
          expect(defaultAgent.dataComponents).toBeDefined();
          expect(defaultAgent.dataComponents).toHaveLength(1);
        }
      }
    });

    it.skip('should update graph with external agents', async () => {
      const tenantId = createTestTenantId('service-update-external');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first (without external agents)
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Update to include external agents
      const updatedGraphData = createFullGraphData(graphData.id, {
        includeExternalAgents: true,
      });

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();
      expect(Object.keys(result.agents)).toHaveLength(3); // 2 internal + 1 external

      // Find external agent
      const externalAgent = Object.values(result.agents).find((agent) =>
        agent.baseUrl?.includes('external-service')
      );
      expect(externalAgent).toBeDefined();
    });

    it.skip('should update graph removing dataComponents', async () => {
      const tenantId = createTestTenantId('service-update-remove-datacomponents');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData(undefined, { includeDataComponents: true });

      // Create the graph first (with dataComponents)
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Update to remove dataComponents
      const updatedGraphData = createFullGraphData(graphData.id);

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();

      // Agent should have no dataComponent relationships
      if (graphData.defaultAgentId) {
        const defaultAgent = result.agents[graphData.defaultAgentId];
        if ('dataComponents' in defaultAgent) {
          expect(defaultAgent.dataComponents || []).toHaveLength(0);
        }
      }
    });

    it.skip('should handle complex update with all components', async () => {
      const tenantId = createTestTenantId('service-update-comprehensive');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const initialGraphData = createFullGraphData();

      // Create initial graph
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, initialGraphData);

      // Update with all components
      const updatedGraphData = createFullGraphData(initialGraphData.id, {
        includeDataComponents: true,
        includeExternalAgents: true,
        includeContextConfig: true,
      });

      const result = await updateFullGraphServerSide(dbClient)(
        { tenantId, projectId },
        updatedGraphData
      );

      expect(result).toBeDefined();
      expect(result.agents).toBeDefined();
      expect(Object.keys(result.agents || {})).toHaveLength(3);
      expect(result.contextConfig).toBeDefined();
    });
  });

  describe('Validation', () => {
    it.skip('should validate tool references in agents', async () => {
      const tenantId = createTestTenantId('service-validate-tools');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Add non-existent tool reference
      const agentId = Object.keys(graphData.agents)[0];
      if (agentId && 'tools' in graphData.agents[agentId]) {
        graphData.agents[agentId].tools = ['non-existent-tool'];
      }

      await expect(
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData)
      ).rejects.toThrow(/Tool reference validation failed/);
    });

    it.skip('should validate dataComponent references in agents', async () => {
      const tenantId = createTestTenantId('service-validate-datacomponents');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Add non-existent dataComponent reference
      const agentId = Object.keys(graphData.agents)[0];
      if (agentId && 'dataComponents' in graphData.agents[agentId]) {
        graphData.agents[agentId].dataComponents = ['non-existent-datacomponent'];
      }

      await expect(
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData)
      ).rejects.toThrow(/DataComponent reference validation failed/);
    });

    it.skip('should validate default agent exists', async () => {
      const tenantId = createTestTenantId('service-validate-default-agent');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Set non-existent default agent
      graphData.defaultAgentId = 'non-existent-agent';

      await expect(
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData)
      ).rejects.toThrow(/Default agent .* does not exist in agents/);
    });

    it.skip('should validate agent relationship references', async () => {
      const tenantId = createTestTenantId('service-validate-relationships');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Add non-existent agent in relationships
      const agentId = Object.keys(graphData.agents)[0];
      if (agentId && 'canTransferTo' in graphData.agents[agentId]) {
        graphData.agents[agentId].canTransferTo = ['non-existent-agent'];
      }

      await expect(
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData)
      ).rejects.toThrow(/Agent relationship validation failed/);
    });
  });

  describe('deleteFullGraph', () => {
    it.skip('should delete an existing graph', async () => {
      const tenantId = createTestTenantId('service-delete');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Verify it exists
      const beforeDelete = await getFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });
      expect(beforeDelete).toBeDefined();

      // Delete it
      const deleteResult = await deleteFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });
      expect(deleteResult).toBe(true);

      // Verify it's deleted
      const afterDelete = await getFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });
      expect(afterDelete).toBeNull();
    });

    it.skip('should return false for non-existent graph', async () => {
      const tenantId = createTestTenantId('service-delete-nonexistent');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const nonExistentId = nanoid();

      const result = await deleteFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: nonExistentId },
      });

      expect(result).toBe(false);
    });

    it.skip('should handle deletion of graph with complex relationships', async () => {
      const tenantId = createTestTenantId('service-delete-complex');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Add more complex relationships
      // const agentIds = Object.keys(graphData.agents);
      // Note: canTransferTo and canDelegateTo are set in the createFullGraphData function
      // and are part of the agent definition, not the returned graph data

      // Create the graph
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Delete it
      const deleteResult = await deleteFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });
      expect(deleteResult).toBe(true);

      // Verify deletion
      const afterDelete = await getFullGraph(dbClient)({
        scopes: { tenantId, projectId, graphId: graphData.id },
      });
      expect(afterDelete).toBeNull();
    });
  });

  describe('Error handling', () => {
    it.skip('should handle invalid graph data', async () => {
      const tenantId = createTestTenantId('service-error');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      // Create graph data with empty agents object
      const invalidGraphData: FullGraphDefinition = {
        id: 'test-graph',
        name: 'Test Graph',
        description: 'Test description',
        defaultAgentId: 'non-existent-agent',
        agents: {}, // Empty agents but defaultAgentId references non-existent agent
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // This should handle the error gracefully
      await expect(
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, invalidGraphData)
      ).rejects.toThrow();
    });
  });

  describe('Parallel operations', () => {
    it.skip('should handle concurrent graph operations on same tenant', async () => {
      const tenantId = createTestTenantId('service-concurrent');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graph1Data = createFullGraphData();
      const graph2Data = createFullGraphData();

      // Create graphs concurrently
      const [result1, result2] = await Promise.all([
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graph1Data),
        createFullGraphServerSide(dbClient)({ tenantId, projectId }, graph2Data),
      ]);

      expect(result1.id).toBe(graph1Data.id);
      expect(result2.id).toBe(graph2Data.id);
      expect(result1.id).not.toBe(result2.id);

      // Verify both exist
      const [get1, get2] = await Promise.all([
        getFullGraph(dbClient)({ scopes: { tenantId, projectId, graphId: graph1Data.id } }),
        getFullGraph(dbClient)({ scopes: { tenantId, projectId, graphId: graph2Data.id } }),
      ]);

      expect(get1).toBeDefined();
      expect(get2).toBeDefined();
      expect(get1?.id).toBe(graph1Data.id);
      expect(get2?.id).toBe(graph2Data.id);
    });

    it.skip('should handle concurrent operations on same graph', async () => {
      const tenantId = createTestTenantId('service-concurrent-same');
      await ensureTestProject(tenantId, 'default');
      const projectId = 'default';

      const graphData = createFullGraphData();

      // Create the graph first
      await createFullGraphServerSide(dbClient)({ tenantId, projectId }, graphData);

      // Perform concurrent get operations
      const [get1, get2, get3] = await Promise.all([
        getFullGraph(dbClient)({ scopes: { tenantId, projectId, graphId: graphData.id } }),
        getFullGraph(dbClient)({ scopes: { tenantId, projectId, graphId: graphData.id } }),
        getFullGraph(dbClient)({ scopes: { tenantId, projectId, graphId: graphData.id } }),
      ]);

      expect(get1).toBeDefined();
      expect(get2).toBeDefined();
      expect(get3).toBeDefined();
      expect(get1?.id).toBe(graphData.id);
      expect(get2?.id).toBe(graphData.id);
      expect(get3?.id).toBe(graphData.id);
    });
  });
});

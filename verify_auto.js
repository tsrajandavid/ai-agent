
const { ActionEngine } = require('./dist/agent/action-engine');
// Mock other dependencies
class MockTaskGroupManager {
    constructor() {
        this.groups = new Map();
    }
    async get(id) { return this.groups.get(id); }
    async updateSubtaskStatus(groupId, taskId, status) {
        const group = this.groups.get(groupId);
        const task = group.subtasks.find(t => t.id === taskId);
        if (task) task.status = status;
        console.log(`[MockManager] Task ${taskId} status updated to: ${status}`);
    }
    async setAutoStatus(id, status) {
        const group = this.groups.get(id);
        if (group) group.isAutoRunning = status;
        console.log(`[MockManager] Group auto-status set to: ${status}`);
    }
}

class MockLLMService {
    sendRequest(messages) { return Promise.resolve("Mock response"); }
}

async function runTest() {
    console.log('Starting Auto-Execution Verification...');

    const manager = new MockTaskGroupManager();
    const llm = new MockLLMService();

    // Setup dummy data
    const groupId = 'test-group';
    manager.groups.set(groupId, {
        id: groupId,
        title: 'Test Plan',
        description: 'Verify auto-execution',
        status: 'in-progress',
        subtasks: [
            { id: 't1', title: 'Task 1', status: 'not-started' },
            { id: 't2', title: 'Task 2', status: 'not-started' }
        ]
    });

    // Mock the agent loop runner
    const runAgentLoop = async (prompt) => {
        console.log('--- Agent Loop Triggered ---');
        console.log('Prompt preview:', prompt.slice(0, 50) + '...');
        return true; // Simulate success
    };

    const engine = new ActionEngine(manager, llm, runAgentLoop);

    // Test Step 1
    console.log('\nExecuting Step 1...');
    const result1 = await engine.executeNextStep(groupId);
    console.log('Step 1 Result:', result1); // Should be true (continue)

    const group = await manager.get(groupId);
    console.log('Task 1 Status:', group.subtasks[0].status); // Should be completed

    // Test Step 2
    console.log('\nExecuting Step 2...');
    const result2 = await engine.executeNextStep(groupId);
    console.log('Step 2 Result:', result2);

    console.log('Task 2 Status:', group.subtasks[1].status);

    // Test Completion (No more tasks)
    console.log('\nExecuting Step 3 (Should be none)...');
    const result3 = await engine.executeNextStep(groupId);
    console.log('Step 3 Result:', result3); // Should be false (stop)

    if (result1 && result2 && !result3 && group.subtasks[1].status === 'completed') {
        console.log('\n✅ Verification PASSED');
    } else {
        console.error('\n❌ Verification FAILED');
        process.exit(1);
    }
}

runTest().catch(e => console.error(e));

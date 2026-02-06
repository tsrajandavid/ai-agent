"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_adapter_1 = require("./src/agent/storage/sqlite-adapter");
const task_group_manager_1 = require("./src/agent/task-group-manager");
async function testStorage() {
    try {
        const workspaceRoot = process.cwd();
        console.log('Initializing SQLite Adapter in:', workspaceRoot);
        const adapter = new sqlite_adapter_1.SQLiteAdapter(workspaceRoot);
        const manager = new task_group_manager_1.TaskGroupManager(adapter);
        // 1. Create a task group
        console.log('Creating task group...');
        const group = await manager.create('Test Group', 'Verify SQLite persistence');
        console.log('Created:', group.id, group.title);
        // 2. Add subtask
        console.log('Adding subtask...');
        const subtask = await manager.addSubtask(group.id, {
            title: 'Test DB',
            description: 'Check if data saves',
            assignedFiles: ['src/test.ts']
        });
        console.log('Added subtask:', subtask.id);
        // 3. Add progress
        console.log('Adding progress...');
        await manager.addProgress(group.id, {
            message: 'Testing progress update',
            type: 'info'
        });
        // 4. Verify persistence
        console.log('Verifying fetching...');
        const fetched = await manager.get(group.id);
        if (!fetched) {
            throw new Error('Failed to fetch group');
        }
        if (fetched.subtasks.length !== 1) {
            throw new Error(`Expected 1 subtask, got ${fetched.subtasks.length}`);
        }
        if (fetched.progress.length !== 2) { // 1 creation + 1 update
            throw new Error(`Expected 2 progress updates, got ${fetched.progress.length}`);
        }
        console.log('✅ Storage verification successful!');
        // Clean up
        await manager.delete(group.id);
        console.log('Cleaned up test data');
    }
    catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}
testStorage();

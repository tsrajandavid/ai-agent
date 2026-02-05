import { Tool } from './tool-interface';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class RunCommandTool implements Tool {
    name = 'run_command';
    description = 'Execute a shell command. Usage: run_command <command>';
    parameters = {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'Command to execute' }
        },
        required: ['command']
    };
    requiresConfirmation = true;

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const command = typeof args === 'string' ? args : args.command;
            if (!command) return 'Error: Missing command';

            // Basic security: preventing some obvious dangerous commands could go here
            // For now, we rely on the user (or future validation layer) 

            const { stdout, stderr } = await exec(command, { cwd: this.workspaceRoot });

            if (stderr && !stdout) {
                return `Stderr: ${stderr}`;
            }

            return stdout + (stderr ? `\nStderr: ${stderr}` : '');
        } catch (error: any) {
            return `Error executing command: ${error.message}`;
        }
    }
}

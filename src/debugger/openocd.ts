import { DebugProtocol } from 'vscode-debugprotocol';
import { GDBServerController, ConfigurationArguments, SWOConfigureEvent, calculatePortMask, createPortName } from './common';
import * as os from 'os';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export class OpenOCDServerController extends EventEmitter implements GDBServerController {
    public portsNeeded = ['gdbPort'];
    public name = 'OpenOCD';
    private args: ConfigurationArguments;
    private ports: { [name: string]: number };

    constructor() {
        super();
    }

    public setPorts(ports: { [name: string]: number }): void {
        this.ports = ports;
    }

    public setArguments(args: ConfigurationArguments): void {
        this.args = args;
    }

    public customRequest(command: string, response: DebugProtocol.Response, args: any): boolean {
        return false;
    }

    public initCommands(): string[] {
        const gdbport = this.ports[createPortName(this.args.targetProcessor)];

        return [
            `target-select extended-remote localhost:${gdbport}`
        ];
    }

    public launchCommands(): string[] {
        const commands = [
            'interpreter-exec console "monitor reset halt"',
            'target-download',
            'interpreter-exec console "monitor reset halt"',
            'enable-pretty-printing'
        ];
        return commands;
    }

    public attachCommands(): string[] {
        const commands = [
            'interpreter-exec console "monitor halt"',
            'enable-pretty-printing'
        ];
        return commands;
    }

    public restartCommands(): string[] {
        const commands: string[] = [
            'interpreter-exec console "monitor reset halt"'
        ];
        return commands;
    }


    public serverExecutable(): string {
        if (this.args.serverpath) { return this.args.serverpath; }
        else {
            return os.platform() === 'win32' ? 'openocd.exe' : 'openocd';
        }
    }

    public serverArguments(): string[] {
        const gdbport = this.ports['gdbPort'];

        let serverargs = [];

        serverargs.push('-c', `gdb_port ${gdbport}`);

        this.args.searchDir.forEach((cs, idx) => {
            serverargs.push('-s', cs);
        });

        if (this.args.searchDir.length === 0) {
            serverargs.push('-s', this.args.cwd);
        }

        for (const cmd of this.args.openOCDPreConfigLaunchCommands || []) {
            serverargs.push('-c', cmd);
        }

        this.args.configFiles.forEach((cf, idx) => {
            serverargs.push('-f', cf);
        });

        if (this.args.rtos) {
            const tmpCfgPath = tmp.tmpNameSync();
            fs.writeFileSync(tmpCfgPath, `$_TARGETNAME configure -rtos ${this.args.rtos}\n`, 'utf8');
            serverargs.push('-f', tmpCfgPath);
        }

        if (this.args.serverArgs) {
            serverargs = serverargs.concat(this.args.serverArgs);
        }

        const commands = [];


        if (commands.length > 0) {
            serverargs.push('-c', commands.join('; '));
        }

        for (const cmd of this.args.openOCDLaunchCommands || []) {
            serverargs.push('-c', cmd);
        }

        return serverargs;
    }

    public initMatch(): RegExp {
        /*
        // Following will work with or without the -d flag to openocd or using the tcl
        // command `debug_level 3`; and we are looking specifically for gdb port(s) opening up
        // When debug is enabled, you get too many matches looking for the cpu. This message
        // has been there atleast since 2016-12-19
        */
        return /Info\s:[^\n]*Listening on port \d+ for gdb connection/i;
    }

    public serverLaunchStarted(): void {
    }

    public serverLaunchCompleted(): void {
    }

    public debuggerLaunchStarted(): void {}
    public debuggerLaunchCompleted(): void {}
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';

const OPENOCD_VALID_RTOS: string[] = ['eCos', 'ThreadX', 'FreeRTOS', 'ChibiOS', 'embKernel', 'mqx', 'uCOS-III', 'auto'];
const JLINK_VALID_RTOS: string[] = ['FreeRTOS', 'embOS'];

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(private context: vscode.ExtensionContext) {}

    public resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        // Flatten the platform specific stuff as it is not done by VSCode at this point.
        switch (os.platform()) {
            case 'darwin': Object.assign(config, config.osx); delete config.osx; break;
            case 'win32': Object.assign(config, config.windows); delete config.windows; break;
            case 'linux': Object.assign(config, config.linux); delete config.linux; break;
            default: console.log(`Unknown platform ${os.platform()}`);
        }
        if (config.debugger_args && !config.debuggerArgs) {
            config.debuggerArgs = config.debugger_args;
        }
        if (!config.debuggerArgs) { config.debuggerArgs = []; }
        
        // TODO implement other server later
        // const type = config.servertype;
        const type = "openocd";

        let validationResponse: string = null;

       
        
        

        if (!config.preLaunchCommands) { config.preLaunchCommands = []; }
        if (!config.postLaunchCommands) { config.postLaunchCommands = []; }
        if (!config.preAttachCommands) { config.preAttachCommands = []; }
        if (!config.postAttachCommands) { config.postAttachCommands = []; }
        if (!config.preRestartCommands) { config.preRestartCommands = []; }
        if (!config.postRestartCommands) { config.postRestartCommands = []; }
        if (config.request !== 'launch') { config.runToMain = false; }
        switch (type) {
            case 'openocd':
                validationResponse = this.verifyOpenOCDConfiguration(folder, config);
                break;
            default:
                // tslint:disable-next-line:max-line-length
                validationResponse = 'Invalid servertype parameters. The following values are supported:  "openocd",  "external"';
                break;
        }

        const configuration = vscode.workspace.getConfiguration('embedded-debug');
        if (config.armToolchainPath) { config.toolchainPath = config.armToolchainPath; }
        if (!config.toolchainPath) {
            config.toolchainPath = configuration.armToolchainPath;
        }
        if (!config.toolchainPrefix) {
            config.toolchainPrefix = configuration.armToolchainPrefix || 'arm-none-eabi';
        }
        
        config.extensionPath = this.context.extensionPath;
        if (os.platform() === 'win32') {
            config.extensionPath = config.extensionPath.replace(/\\/g, '/'); // GDB doesn't interpret the path correctly with backslashes.
        }

        config.flattenAnonymous = configuration.flattenAnonymous;
        config.registerUseNaturalFormat = configuration.registerUseNaturalFormat;
        
        if (validationResponse) {
            vscode.window.showErrorMessage(validationResponse);
            return undefined;
        }
        
        return config;
    }

   

    private verifyOpenOCDConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration): string {
        if (config.openOCDPath && !config.serverpath) { config.serverpath = config.openOCDPath; }
        if (!config.serverpath) {
            const configuration = vscode.workspace.getConfiguration('embedded-debug');
            config.serverpath = configuration.openocdPath;
        }

        if (config.rtos && OPENOCD_VALID_RTOS.indexOf(config.rtos) === -1) {
            return `The following RTOS values are supported by OpenOCD: ${OPENOCD_VALID_RTOS.join(' ')}`;
        }

        if (!config.configFiles || config.configFiles.length === 0) {
            return 'At least one OpenOCD Configuration File must be specified.';
        }

        if (!config.searchDir || config.searchDir.length === 0) {
            config.searchDir = [];
        }
        
        return null;
    }

   
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { PeripheralTreeProvider } from './views/peripheral';
import { RegisterTreeProvider } from './views/registers';
import { BaseNode, PeripheralBaseNode } from './views/nodes/basenode';
import { MemoryContentProvider } from './memory_content_provider';
import { DebugConfigurationProvider } from './configprovider';
import { SymbolInformation, SymbolScope } from './symbols';


interface SVDInfo {
    expression: RegExp;
    path: string;
}


export class EmbeddedDebugger {
    private adapterOutputChannel: vscode.OutputChannel = null;
    private clearAdapterOutputChannel = false;

    private peripheralProvider: PeripheralTreeProvider;
    private registerProvider: RegisterTreeProvider;
    private memoryProvider: MemoryContentProvider;

    private peripheralTreeView: vscode.TreeView<PeripheralBaseNode>;
    private registerTreeView: vscode.TreeView<BaseNode>;

    private SVDDirectory: SVDInfo[] = [];
    private functionSymbols: SymbolInformation[] = null;

    constructor(private context: vscode.ExtensionContext) {
        this.peripheralProvider = new PeripheralTreeProvider();
        this.registerProvider = new RegisterTreeProvider();
        this.memoryProvider = new MemoryContentProvider();

        /**
         * create peripherals and registers views
         */
        this.peripheralTreeView = vscode.window.createTreeView('embedded-debug.peripherals', {
            treeDataProvider: this.peripheralProvider
        });

        this.registerTreeView = vscode.window.createTreeView('embedded-debug.registers', {
            treeDataProvider: this.registerProvider
        });

        const provider = new DebugConfigurationProvider(context);
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('embedded-debug', provider));
    
        context.subscriptions.push(
            vscode.debug.onDidReceiveDebugSessionCustomEvent(this.receivedCustomEvent.bind(this)),
            vscode.debug.onDidStartDebugSession(this.debugSessionStarted.bind(this)),
            vscode.debug.onDidTerminateDebugSession(this.debugSessionTerminated.bind(this)),
            this.registerTreeView,
            this.registerTreeView.onDidCollapseElement((e) => {
                e.element.expanded = false;
            }),
            this.registerTreeView.onDidExpandElement((e) => {
                e.element.expanded = true;
            }),
            this.peripheralTreeView,
            this.peripheralTreeView.onDidExpandElement((e) => {
                e.element.expanded = true;
                e.element.getPeripheral().updateData();
                this.peripheralProvider.refresh();
            }),
            this.peripheralTreeView.onDidCollapseElement((e) => {
                e.element.expanded = false;
            })
        );
    }
     // Debug Events
     private debugSessionStarted(session: vscode.DebugSession) {

        if (session.type !== 'embedded-debug') { return; }

        this.functionSymbols = null;

        session.customRequest('get-arguments').then((args) => {
            let svdfile = args.svdFile;
            if (!svdfile) {
                svdfile = this.getSVDFile(args.device);
            }

            
            this.registerProvider.debugSessionStarted();
            this.peripheralProvider.debugSessionStarted(svdfile ? svdfile : null);

        }, (error) => {
            // TODO: Error handling for unable to get arguments
        });
    }

    private debugSessionTerminated(session: vscode.DebugSession) {
        if (session.type !== 'embedded-debug') { return; }

        this.registerProvider.debugSessionTerminated();
        this.peripheralProvider.debugSessionTerminated();
        
        this.clearAdapterOutputChannel = true;
    }


    private receivedCustomEvent(e: vscode.DebugSessionCustomEvent) {
        if (vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.type !== 'embedded-debug') { return; }
        switch (e.event) {
            case 'custom-stop':
                this.receivedStopEvent(e);
                break;
            case 'custom-continued':
                this.receivedContinuedEvent(e);
                break;
          
            case 'adapter-output':
                this.receivedAdapterOutput(e);
                break;
            case 'record-event':
                this.receivedEvent(e);
                break;
            default:
                break;
        }
    }

    private receivedStopEvent(e) {
        this.peripheralProvider.debugStopped();
        this.registerProvider.debugStopped();
        vscode.workspace.textDocuments.filter((td) => td.fileName.endsWith('.cdmem'))
            .forEach((doc) => { this.memoryProvider.update(doc); });
    }

    private receivedContinuedEvent(e) {
        this.peripheralProvider.debugContinued();
        this.registerProvider.debugContinued();
    }

    private receivedEvent(e) {
        //Reporting.sendEvent(e.body.category, e.body.action, e.body.label, e.body.parameters);
    }

   

    private receivedAdapterOutput(e) {
        if (!this.adapterOutputChannel) {
            this.adapterOutputChannel = vscode.window.createOutputChannel('Adapter Output');
            this.adapterOutputChannel.show();
        } else if (this.clearAdapterOutputChannel) {
            this.adapterOutputChannel.clear();
        }
        this.clearAdapterOutputChannel = false;

        let output = e.body.content;
        if (!output.endsWith('\n')) { output += '\n'; }
        this.adapterOutputChannel.append(output);
    }

    private getSVDFile(device: string): string {
        const entry = this.SVDDirectory.find((de) => de.expression.test(device));
        return entry ? entry.path : null;
    }

    public registerSVDFile(expression: RegExp | string, path: string): void {
        if (typeof expression === 'string') {
            expression = new RegExp(`^${expression}$`, '');
        }

        this.SVDDirectory.push({ expression: expression, path: path });
    }

}

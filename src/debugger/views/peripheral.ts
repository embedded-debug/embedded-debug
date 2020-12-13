import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { ProviderResult } from 'vscode';
import { NodeSetting } from '../common';
import { PeripheralBaseNode } from './nodes/basenode';
import { PeripheralNode } from './nodes/peripheralnode';
import { SVDParser } from '../svd/svd';
import { MessageNode } from './nodes/messagenode';

export class PeripheralTreeProvider implements vscode.TreeDataProvider<PeripheralBaseNode> {
    // tslint:disable-next-line:variable-name
    public _onDidChangeTreeData: vscode.EventEmitter<PeripheralBaseNode | undefined> = new vscode.EventEmitter<PeripheralBaseNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<PeripheralBaseNode | undefined> = this._onDidChangeTreeData.event;
    
    private peripherials: PeripheralNode[] = [];
    private loaded: boolean = false;
    private svdFileName: string | null;
    
    constructor() {

    }

    private saveState(path: string): void {
        const state: NodeSetting[] = [];
        this.peripherials.forEach((p) => {
            state.push(... p.saveState());
        });
        
        fs.writeFileSync(path, JSON.stringify(state), { encoding: 'utf8', flag: 'w' });
    }
    
    private loadSVD(SVDFile: string): Thenable<any> {
        if (!path.isAbsolute(SVDFile)) {
            const fullpath = path.normalize(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, SVDFile));
            SVDFile = fullpath;
        }

        this.svdFileName = SVDFile;
        return SVDParser.parseSVD(SVDFile).then((peripherals) => {
            this.peripherials = peripherals;
            this.loaded = true;
            return true;
        });
    }

    private findNodeByPath(path: string): PeripheralBaseNode {
        const pathParts = path.split('.');
        const peripheral = this.peripherials.find((p) => p.name === pathParts[0]);
        if (!peripheral) { return null; }
        
        return peripheral.findByPath(pathParts.slice(1));
    }

    public refresh(): void {
        //TODO reimplement
        this._onDidChangeTreeData.fire(null);
    }

    public getTreeItem(element: PeripheralBaseNode): vscode.TreeItem | Promise<vscode.TreeItem> {
        return element.getTreeItem();
    }

    public getChildren(element?: PeripheralBaseNode): ProviderResult<PeripheralBaseNode[]> {
        if (this.loaded && this.peripherials.length > 0) {
            if (element) {
                return element.getChildren();
            }
            else {
                return this.peripherials;
            }
        }
        else if (!this.loaded) {
            return [new MessageNode('No SVD File Loaded: ' + this.svdFileName || 'None', null)];
        }
        else {
            return [];
        }
    }

    public debugSessionStarted(svdfile: string): Thenable<any> {
        return new Promise((resolve, reject) => {
            this.peripherials = [];
            this.loaded = false;
            //TODO reimplement
            this._onDidChangeTreeData.fire(null);
            
            if (svdfile) {
                setTimeout(() => {
                    this.loadSVD(svdfile).then(
                        () => {
                            vscode.workspace.findFiles('.vscode/.embedded-debug.peripherals.state.json', null, 1).then((value) => {
                                if (value.length > 0) {
                                    const fspath = value[0].fsPath;
                                    const data = fs.readFileSync(fspath, 'utf8');
                                    const settings = JSON.parse(data);
                                    settings.forEach((s: NodeSetting) => {
                                        const node = this.findNodeByPath(s.node);
                                        if (node) {
                                            node.expanded = s.expanded || false;
                                            node.format = s.format;
                                        }
                                    });
                                    this._onDidChangeTreeData.fire(null);
                                }
                            }, (error) => {

                            });
                            this._onDidChangeTreeData.fire(null);
                            resolve(null);
                        },
                        (e) => {
                            this.peripherials = [];
                            this.loaded = false;
                            this._onDidChangeTreeData.fire(null);
                            const msg = `Unable to parse SVD file: ${e.toString()}`;
                            vscode.window.showErrorMessage(msg);
                            if (vscode.debug.activeDebugConsole) {
                                vscode.debug.activeDebugConsole.appendLine(msg);
                            }
                            resolve(null);
                        }
                    );
                }, 150);
            }
            else {
                resolve(null);
            }
        });
    }

    public debugSessionTerminated(): Thenable<any> {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const fspath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vscode', '.embedded-debug.peripherals.state.json');
            this.saveState(fspath);
        }
        
        this.peripherials = [];
        this.loaded = false;
        this._onDidChangeTreeData.fire(null);
        return Promise.resolve(true);
    }

    public debugStopped() {
        if (this.loaded) {
            const promises = this.peripherials.map((p) => p.updateData());
            Promise.all(promises).then((_) => { this._onDidChangeTreeData.fire(null); }, (_) => { this._onDidChangeTreeData.fire(null); });
        }
    }

    public debugContinued() {
        
    }
}

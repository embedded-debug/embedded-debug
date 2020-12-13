/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as Net from 'net';
import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { platform } from 'process';
import { ProviderResult } from 'vscode';
import { EmbeddedDebugSession } from './embeddedDebug';
import { activateEmbeddedDebug, workspaceFileAccessor } from './activateEmbeddedDebug';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'namedPipeServer' | 'inline' = 'inline';

export function activate(context: vscode.ExtensionContext) {
	console.info('debgger activate')
	activateEmbeddedDebug(context);
}

export function deactivate() {
	console.info('debgger deactivate')
	// nothing to do
}

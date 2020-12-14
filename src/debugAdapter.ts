/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EmbeddedDebugSession } from './embeddedDebug';
import { readFile } from 'fs';
import * as Net from 'net';
import { FileAccessor } from './debugRuntime';
import { DebugSession } from 'vscode-debugadapter';
import { GDBDebugSession } from './debugger/gdb';

/*
 * debugAdapter.js is the entrypoint of the debug adapter when it runs as a separate process.
 */

/*
 * Since here we run the debug adapter as a separate ("external") process, it has no access to VS Code API.
 * So we can only use node.js API for accessing files.
 */
const fsAccessor:  FileAccessor = {
	async readFile(path: string): Promise<string> {
		return new Promise((resolve, reject) => {
			readFile(path, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data.toString());
				}
			});
		});
	}
};

/*
 * When the debug adapter is run as an external process,
 * normally the helper function DebugSession.run(...) takes care of everything:
 *
 * 	MockDebugSession.run(MockDebugSession);
 *
 * but here the helper is not flexible enough to deal with a debug session constructors with a parameter.
 * So for now we copied and modified the helper:
 */


//Write to output.

DebugSession.run(GDBDebugSession);


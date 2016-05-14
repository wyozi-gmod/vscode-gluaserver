/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, ITextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentIdentifier,
	CompletionItem, CompletionItemKind, Files
} from 'vscode-languageserver';

import path = require('path');
import fs = require('fs');
import childProcess = require('child_process');

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});

let errorRegex = new RegExp('\\[([^\\]]+)\\] line (\\d+), column (\\d+): (.+)');
function validateTextDocument(textDocument: ITextDocument): void {
	let linterBinPath = path.join(__dirname, '../../server/glualint');
	connection.console.log("lel");
	connection.console.log(linterBinPath);
	
	let stdout = childProcess.execFileSync(linterBinPath, ['stdin'], {input: textDocument.getText()});
	
	let diagnostics: Diagnostic[] = [];

	let lines = stdout.toString().split('\n');	
	for (let i = 0; i < lines.length; i++) {
		let m = errorRegex.exec(lines[i]);
		
		if (m != null) {
			var severity = DiagnosticSeverity.Error;
			if (m[1] == 'Warning') {
				severity = DiagnosticSeverity.Warning;
			}
			
			diagnostics.push({
				severity: severity,
				range: {
					start: { line: parseInt(m[2]) - 1, character: parseInt(m[3]) - 1},
					end: { line: parseInt(m[2]) - 1, character: parseInt(m[3]) - 1 + 3 }
				},
				message: m[4],
				source: 'glualint'
			});
		}
	}
	
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Listen on the connection
connection.listen();
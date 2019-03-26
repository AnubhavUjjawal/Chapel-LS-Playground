/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	TextDocumentEdit,
	TextDocumentItem,
	TextEdit,
	Hover,
	CompletionParams,
	HoverRequest,
	MarkedString,
} from 'vscode-languageserver';
import * as fs from 'fs';
import { provideAutoCompletionResult } from './autocompletion';
import { execSync } from 'child_process';
import { HandlerResult } from 'vscode-jsonrpc';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// A simple cache of TextDocuments with their uri as key
let documents = new Map<String, TextDocument>();

// Might convert the value to an enum
let variableTypes = new Map<String, String>();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability =
		!!(capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation);

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				// :TODO: Incremental documentChanges 
				change: TextDocumentSyncKind.Full
			},
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true
			},
			// Tell the client the server supports hover
			hoverProvider: true
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	// documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'chapel'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// // Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
// documents.onDidChangeContent(change => {
// 	validateTextDocument(change.document);
// });

// async function validateTextDocument(textDocument: TextDocument): Promise<void> {
// 	// In this simple example we get the settings for every validate run.
// 	let settings = await getDocumentSettings(textDocument.uri);

// 	// The validator creates diagnostics for all uppercase words length 2 and more
// 	let text = textDocument.getText();
// 	let pattern = /\b[A-Z]{2,}\b/g;
// 	let m: RegExpExecArray | null;

// 	let problems = 0;
// 	let diagnostics: Diagnostic[] = [];
// 	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
// 		problems++;
// 		let diagnostic: Diagnostic = {
// 			severity: DiagnosticSeverity.Warning,
// 			range: {
// 				start: textDocument.positionAt(m.index),
// 				end: textDocument.positionAt(m.index + m[0].length)
// 			},
// 			message: `${m[0]} is all uppercase.`,
// 			source: 'ex'
// 		};
// 		if (hasDiagnosticRelatedInformationCapability) {
// 			diagnostic.relatedInformation = [
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Spelling matters'
// 				},
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Particularly for names'
// 				}
// 			];
// 		}
// 		diagnostics.push(diagnostic);
// 	}

// 	// Send the computed diagnostics to VSCode.
// 	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		// connection.console.log("at line number " + JSON.stringify(_textDocumentPosition));
		return provideAutoCompletionResult(_textDocumentPosition);
	}	
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem) => {
		return item;
	}
);

connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
	let newDoc =  TextDocument.create(params.textDocument.uri,
		params.textDocument.languageId,
		params.textDocument.version,
		params.textDocument.text);
	documents.set(newDoc.uri, newDoc);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	let oldDoc = documents.get(params.textDocument.uri);
	documents.set(params.textDocument.uri, TextDocument.create(params.textDocument.uri,
												oldDoc.languageId,
												params.textDocument.version,
												params.contentChanges.slice(-1).pop().text));
	connection.console.log(`${params.textDocument.uri} changed to: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	documents.delete(params.textDocument.uri);
	connection.console.log(`${params.textDocument.uri} closed.`);
});

connection.onHover(
	// Testing hover
	(_textDocumentPosition:TextDocumentPositionParams): Hover  => {
		let doc = documents.get(_textDocumentPosition.textDocument.uri);
		
		// need to extract variable from `_textDocumentPosition` to `tobeFoundVar`
		let tobeFoundVar = "s";
		// TODO: throttle this to every 5 seconds
		// Write new code to file, compile and produce logs.
		fs.writeFileSync(__dirname + `/text.chpl`, doc.getText());
		connection.console.log("The file was saved for evaluation!");
		// remove any previous log files and create new logs
		execSync("rm -rf log && chpl text.chpl --log-pass r --stop-after-pass resolve", {cwd: __dirname})
		
		let typeResolves = fs.readFileSync(__dirname + "/log/text_13resolve.ast").toString();
		// // connection.console.log(typeResolves);
		let regexp = new RegExp(`${tobeFoundVar}\\[\\d+\\]:\\w+\\(\\d+\\)`);
		var hover = {contents: regexp.exec(typeResolves)};
		return hover;
	}
);

// documents.onDidChangeContent((event) => {
// 	connection.console.log(`[Server(${process.pid})] Document content changed: ${event.document.uri}`);
// })


// Listen on the connection
connection.listen();

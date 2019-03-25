import * as fs from 'fs';
import { 
	CompletionItem,
	TextDocumentPositionParams, 
	CompletionItemKind
} from 'vscode-languageserver';

export function provideAutoCompletionResult(_textDocumentPosition: TextDocumentPositionParams) : CompletionItem[] {
	// Need to create for the following keywords
	// ['align', 'as', 'atomic', 'begin', 'break', 'by', 'class', 
	// 'cobegin', 'coforall', 'config', 'const', 'continue', 'delete', 'dmapped', 
	// 'inout', 'do', 'iter', 'domain', 'label', 'else', 'let', 'enum', 'local', 
	// 'except', 'module', 'export', 'new', 'extern', 'nil', 'for', 'noinit', 
	// 'forall', 'on', 'if', 'only', 'in', 'otherwise', 'index', 'out', 'inline', 
	// 'param', 'private', 'subdomain', 'proc', 'sync', 'public', 'then', 'record', 
	// 'type', 'reduce', 'union', 'ref', 'use', 'require', 'var', 'return', 'when', 
	// 'scan', 'where', 'select', 'while', 'serial', 'with', 'single', 'yield', 'sparse', 
	// 'zip']
	return [
		{
			label: "align",
			kind: CompletionItemKind.Text
		},
		{
			label: "atomic",
			kind: CompletionItemKind.Property
		},
		{
			label: "begin",
			kind: CompletionItemKind.Keyword
		},
		{
			label: "while",
			kind: CompletionItemKind.Keyword
		},
		{
			label: "public",
			kind: CompletionItemKind.Property
		},
		{
			label: "private",
			kind: CompletionItemKind.Property
		}
	];
}

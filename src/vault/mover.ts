import type { App, TFile } from 'obsidian';

/** Joins the categorized root folder and the nested category labels into a vault folder path. */
export function destinationFolder(root: string, labels: string[]): string {
	return [root, ...labels]
		.map((segment) => segment.replace(/^\/+|\/+$/g, ''))
		.filter((segment) => segment !== '')
		.join('/');
}

export function destinationPath(folder: string, fileName: string): string {
	return folder === '' ? fileName : `${folder}/${fileName}`;
}

/** The folder path of a note; the vault root is an empty string. */
export function currentFolder(file: TFile): string {
	const path = file.parent?.path ?? '';
	return path === '/' ? '' : path;
}

/** True when a different file already occupies the destination path. */
export function hasNameConflict(app: App, file: TFile, folder: string): boolean {
	if (folder === currentFolder(file)) {
		return false;
	}
	return app.vault.getAbstractFileByPath(destinationPath(folder, file.name)) !== null;
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	let path = '';
	for (const segment of folder.split('/')) {
		path = path === '' ? segment : `${path}/${segment}`;
		if (app.vault.getAbstractFileByPath(path) === null) {
			await app.vault.createFolder(path);
		}
	}
}

/**
 * Moves a note into a folder, creating the folder levels that do not exist.
 * Uses `fileManager.renameFile` so that links to the note are updated.
 * Throws when a different file already has the destination path.
 */
export async function moveNote(app: App, file: TFile, folder: string): Promise<void> {
	if (folder === currentFolder(file)) {
		return;
	}
	const path = destinationPath(folder, file.name);
	if (hasNameConflict(app, file, folder)) {
		throw new Error(`A file named "${file.name}" already exists in "${folder}".`);
	}
	await ensureFolder(app, folder);
	await app.fileManager.renameFile(file, path);
}

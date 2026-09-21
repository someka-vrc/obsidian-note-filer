import { TFile, TFolder, type TAbstractFile } from 'obsidian';

/** Collects the markdown notes in the targets. Folders are searched recursively. */
export function collectMarkdownFiles(targets: TAbstractFile[]): TFile[] {
	const files = new Map<string, TFile>();
	const visit = (target: TAbstractFile) => {
		if (target instanceof TFile) {
			if (target.extension === 'md') {
				files.set(target.path, target);
			}
		} else if (target instanceof TFolder) {
			target.children.forEach(visit);
		}
	};
	targets.forEach(visit);
	return [...files.values()];
}

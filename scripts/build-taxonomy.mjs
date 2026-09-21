// Converts the raw taxonomy files in assets/raw into the nested JSON bundled into the plugin.
// Usage: npm run taxonomy
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'assets', 'raw');
const outDir = join(root, 'src', 'taxonomy', 'data');

/**
 * Makes a label usable as a folder name.
 * `&` becomes `and`; characters not allowed in paths become a space; runs of spaces are collapsed.
 */
function sanitizeLabel(label) {
	return label
		.replace(/\s*&\s*/g, ' and ')
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/[. ]+$/, '')
		.trim();
}

/** Builds the nested tree from flat `{ code, label, parent }` items (parents must be listed by code). */
function buildTree(items, name) {
	const nodes = new Map();
	for (const item of items) {
		if (nodes.has(item.code)) {
			throw new Error(`${name}: duplicate code ${item.code}`);
		}
		if (item.label === '') {
			throw new Error(`${name}: empty label for code ${item.code}`);
		}
		nodes.set(item.code, { code: item.code, label: item.label });
	}

	const children = [];
	for (const item of items) {
		const node = nodes.get(item.code);
		if (item.parent === '') {
			children.push(node);
			continue;
		}
		const parent = nodes.get(item.parent);
		if (!parent) {
			throw new Error(`${name}: parent ${item.parent} of ${item.code} not found`);
		}
		(parent.children ??= []).push(node);
	}

	warnSiblingCollisions(children, name, '(root)');
	return { root: { children } };
}

/** Sibling labels that collapse to the same folder name would put different categories in one folder. */
function warnSiblingCollisions(siblings, name, path) {
	const seen = new Map();
	for (const node of siblings) {
		const key = node.label.toLowerCase();
		if (seen.has(key)) {
			console.warn(`${name}: sibling labels collide under ${path}: ${seen.get(key)} / ${node.code} "${node.label}"`);
		}
		seen.set(key, node.code);
		if (node.children) {
			warnSiblingCollisions(node.children, name, `${path}/${node.label}`);
		}
	}
}

function countByDepth(children, depth = 1, counts = []) {
	counts[depth - 1] = (counts[depth - 1] ?? 0) + children.length;
	for (const node of children) {
		if (node.children) {
			countByDepth(node.children, depth + 1, counts);
		}
	}
	return counts;
}

/** Thema: flat `Code` list linked by `CodeParent`. Qualifiers (codes starting with a digit) are excluded. */
function convertThema() {
	const dir = join(rawDir, 'Thema');
	const file = readdirSync(dir)
		.filter((name) => /_en\.json$/.test(name))
		.sort()
		.pop();
	if (!file) {
		throw new Error(`Thema: no *_en.json in ${dir}`);
	}

	const codes = JSON.parse(readFileSync(join(dir, file), 'utf8')).CodeList.ThemaCodes.Code;
	const isQualifier = (code) => /^[0-9]/.test(code);
	const items = [];
	for (const entry of codes) {
		const code = String(entry.CodeValue);
		if (isQualifier(code)) {
			continue;
		}
		const parent = String(entry.CodeParent ?? '');
		if (isQualifier(parent)) {
			throw new Error(`Thema: ${code} has qualifier parent ${parent}`);
		}
		items.push({ code, label: sanitizeLabel(entry.CodeDescription), parent });
	}
	return { source: file, tree: buildTree(items, 'Thema') };
}

/** IAB Content Taxonomy: TSV with two header rows; `Unique ID`, `Parent`, `Name` are columns 0 to 2. */
function convertIab() {
	const dir = join(rawDir, 'IAB_ContentsTaxonomy');
	const file = readdirSync(dir).find((name) => name.endsWith('.tsv'));
	if (!file) {
		throw new Error(`IAB: no .tsv in ${dir}`);
	}

	const lines = readFileSync(join(dir, file), 'utf8').split(/\r?\n/).slice(2);
	const items = [];
	for (const line of lines) {
		const [code = '', parent = '', name = ''] = line.split('\t').map((cell) => cell.trim());
		if (code === '') {
			continue;
		}
		items.push({ code, label: sanitizeLabel(name), parent });
	}
	return { source: file, tree: buildTree(items, 'IAB') };
}

mkdirSync(outDir, { recursive: true });
for (const [outName, convert] of [
	['Thema.json', convertThema],
	['IAB_ContentsTaxonomy.json', convertIab],
]) {
	const { source, tree } = convert();
	writeFileSync(join(outDir, outName), `${JSON.stringify(tree, null, 2)}\n`);
	console.log(`${outName}: from ${source}, nodes per depth = ${countByDepth(tree.root.children).join(', ')}`);
}

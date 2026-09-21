import { setIcon, setTooltip } from 'obsidian';
import type { Plugin } from 'obsidian';

export interface StatusBarCallbacks {
	onClick: () => void;
	onCancel: () => void;
}

const START_LABEL = 'Categorize current note and move';
const CANCEL_LABEL = 'Note Filer: Cancel';

export class StatusBarController {
	private readonly iconEl: HTMLElement;
	private readonly progressEl: HTMLProgressElement;
	private readonly cancelEl: HTMLElement;
	private running = false;

	constructor(plugin: Plugin, callbacks: StatusBarCallbacks) {
		const containerEl = plugin.addStatusBarItem();
		containerEl.addClass('note-filer-status');

		this.iconEl = containerEl.createSpan({ cls: 'note-filer-status-button' });
		setIcon(this.iconEl, 'library-big');
		this.makeButton(plugin, this.iconEl, START_LABEL, () => {
			// A run is already in progress; do not start another.
			if (!this.running) {
				callbacks.onClick();
			}
		});

		this.progressEl = containerEl.createEl('progress', { cls: 'note-filer-status-progress' });
		this.cancelEl = containerEl.createSpan({ cls: 'note-filer-status-button' });
		setIcon(this.cancelEl, 'circle-x');
		this.makeButton(plugin, this.cancelEl, CANCEL_LABEL, () => {
			if (this.running) {
				callbacks.onCancel();
			}
		});

		this.hideProgress();
	}

	showProgress(done: number, total: number): void {
		this.running = true;
		if (total > 0) {
			this.progressEl.max = total;
			this.progressEl.value = Math.min(Math.max(done, 0), total);
		} else {
			// No total yet: show an indeterminate bar.
			this.progressEl.removeAttribute('value');
		}
		this.progressEl.toggleClass('note-filer-hidden', false);
		this.cancelEl.toggleClass('note-filer-hidden', false);
		this.iconEl.toggleClass('is-disabled', true);
		this.iconEl.setAttribute('aria-disabled', 'true');
	}

	hideProgress(): void {
		this.running = false;
		this.progressEl.toggleClass('note-filer-hidden', true);
		this.cancelEl.toggleClass('note-filer-hidden', true);
		this.iconEl.toggleClass('is-disabled', false);
		this.iconEl.removeAttribute('aria-disabled');
	}

	private makeButton(plugin: Plugin, el: HTMLElement, label: string, onActivate: () => void): void {
		el.setAttribute('role', 'button');
		el.setAttribute('tabindex', '0');
		el.setAttribute('aria-label', label);
		setTooltip(el, label);
		plugin.registerDomEvent(el, 'click', () => onActivate());
		plugin.registerDomEvent(el, 'keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onActivate();
			}
		});
	}
}

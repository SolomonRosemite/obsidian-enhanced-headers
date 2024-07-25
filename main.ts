import {
	Plugin,
	MarkdownView,
	TFile,
	Notice,
	Setting,
	App,
	PluginSettingTab,
} from "obsidian";
import manifest from "./manifest.json";
import { BacklinkPluginSettings, Classes, DEFAULT_SETTINGS } from "types";

export default class BacklinkPlugin extends Plugin {
	private metadataCacheIsLoaded = false;
	private firstLoad = true;
	settings: BacklinkPluginSettings;

	async onload() {
		console.log(`Loading ${manifest.name} ${manifest.version}`);

		this.addSettingTab(new BacklinkPluginSettingTab(this.app, this));

		await this.loadSettings();

		// Perhaps the cache is already loaded if the plugin is reloaded
		this.metadataCacheIsLoaded =
			!!this.app.metadataCache.resolvedLinks.length;

		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				this.handleActiveNoteChange.bind(this),
			),
		);
		this.registerEvent(
			this.app.vault.on("modify", this.handleContentChange.bind(this)),
		);
	}

	onunload() {
		console.log(`Unloading ${manifest.name} ${manifest.version}`);

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const group = view.containerEl.querySelector(Classes.group(true));
			if (group) {
				group.remove();
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	handleContentChange(file: TFile) {
		if (file.extension !== "md") return; // Only handle markdown files

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file === file) {
			this.handlers(view);
		}
	}

	handleActiveNoteChange() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			this.handlers(view);
		}
	}

	async handlers(view: MarkdownView) {
		if (!this.metadataCacheIsLoaded) {
			await new Promise<boolean>((resolve) => {
				const timeout = setTimeout(() => resolve(false), 5000);
				this.app.metadataCache.on("resolved", () => {
					clearTimeout(timeout);
					resolve(true);
				});
			});
			this.metadataCacheIsLoaded = true;
		}

		// handlers
		this.displayLinks(view);
	}

	async displayLinks(view: MarkdownView) {
		if (!this.metadataCacheIsLoaded) {
			await new Promise<boolean>((resolve) => {
				const timeout = setTimeout(() => resolve(false), 5000);
				this.app.metadataCache.on("resolved", () => {
					clearTimeout(timeout);
					resolve(true);
				});
			});
			this.metadataCacheIsLoaded = true;
		}

		const file = view.file!;
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;

		const group = view.containerEl.querySelector(Classes.group(true));
		if (group) {
			group.remove();
		}

		const backlinkSet = new Set<string>();
		const linkSet = new Set<string>();
		const unlinkedLinkSet = new Set<string>();
		for (let linkedFile in resolvedLinks) {
			if (resolvedLinks[linkedFile][file.path]) {
				backlinkSet.add(linkedFile);
			}
			if (resolvedLinks[file.path][linkedFile]) {
				linkSet.add(linkedFile);
			}
		}

		for (let linkedFile in unresolvedLinks[file.path]) {
			unlinkedLinkSet.add(linkedFile);
		}

		const linkSort = (a: HTMLAnchorElement, b: HTMLAnchorElement) => {
			return a.textContent!.localeCompare(b.textContent!);
		};

		const backlinkGroup = this.createGroup(
			"Backlinks",
			this.linksToElements(backlinkSet).sort(linkSort),
		);
		const linkGroup = this.createGroup(
			"Links",
			[
				this.linksToElements(linkSet, true),
				this.linksToElements(unlinkedLinkSet, false),
			]
				.flat()
				.sort(linkSort),
		);

		const hr = document.createElement("hr");
		const groups = this.settings.backlinksFirst
			? [backlinkGroup, linkGroup]
			: [linkGroup, backlinkGroup];

		if (!this.settings.showLinks) {
			groups.splice(groups.indexOf(linkGroup), 1);
		}

		if (!this.settings.showBacklinks) {
			groups.splice(groups.indexOf(backlinkGroup), 1);
		}

		if (groups.length == 2) {
			groups.splice(1, 0, hr);
		}

		this.addGroup(view, groups);

		if (this.firstLoad) {
			// due to the DOM changes, the cursor looks way off. moving the cursor slightly solves the issue
			this.moveCursorRight();
			this.firstLoad = false;
		}
	}

	moveCursorRight() {
		const ae = this.app.workspace.activeEditor;
		if (!ae?.editor) return;
		const editor = ae.editor!;
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line);
		if (cursor.ch < lineText.length) {
			editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
			editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
		} else {
			editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
			editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
		}
	}

	linksToElements(links: Set<string>, resolvedLink = true) {
		return Array.from(links).map((linkedFile) => {
			const filePath = resolvedLink
				? linkedFile.substring(0, linkedFile.length - 3)
				: linkedFile;
			const linkElement = document.createElement("a");
			linkElement.href = "#";
			linkElement.textContent = filePath.substring(
				linkedFile.lastIndexOf("/") + 1,
			);
			linkElement.onclick = (event) => {
				event.preventDefault();
				this.app.workspace.openLinkText(filePath, "", false);
			};

			if (!resolvedLink) {
				linkElement.style.color = "var(--link-unresolved-color)";
				linkElement.style.opacity = "var(--link-unresolved-opacity)";
			}

			return linkElement;
		});
	}

	addGroup(view: MarkdownView, groups: Element[]) {
		const group = document.createElement("div");
		group.addClass(Classes.group());

		const attachedElement = this.settings.attachTop
			? view.containerEl.querySelector(".view-content")
			: view.containerEl.querySelector(Classes.obsidianCmSizer(true));

		if (!attachedElement) {
			console.error(
				"Title header not found. Possible version update issue.",
			);
			new Notice(
				`[${manifest.name}] Can't show links. Title element not found. There is a chance Obsidian has updated. Check for plugin updates for "${manifest.name}"`,
				0,
			);
			return;
		}

		attachedElement.insertAdjacentElement("afterbegin", group);
		groups.forEach((g) => {
			group.appendChild(g);
		});
	}

	createGroup(title: string, linkElements: HTMLAnchorElement[]) {
		const group = document.createElement("div");

		const titleEl = document.createElement("h6");
		titleEl.addClass(Classes.groupTitle());
		titleEl.textContent = title;
		if (this.settings.showLinkTitle) {
			group.appendChild(titleEl);
		}

		const links = document.createElement("div");
		links.addClass(Classes.backlinks());

		group.appendChild(links);
		for (let i = 0; i < linkElements.length * 2 - 1; i++) {
			if (i % 2 == 0) {
				links.appendChild(linkElements[i / 2]);
				continue;
			}
			links.appendText(this.settings.separator);
		}

		return group;
	}
}

class BacklinkPluginSettingTab extends PluginSettingTab {
	plugin: BacklinkPlugin;

	constructor(app: App, plugin: BacklinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", {
			text: `${manifest.name} Plugin Settings (v${manifest.version})`,
		});

		const changeSettingAndRunHandlers = async (
			newSettings: Partial<BacklinkPluginSettings>,
		) => {
			this.plugin.settings = { ...this.plugin.settings, ...newSettings };
			await this.plugin.saveSettings();

			const view =
				this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) this.plugin.handlers(view);
		};

		new Setting(containerEl)
			.setName("Show Links")
			.setDesc("Show links in the markdown file.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showLinks)
					.onChange(async (showLinks) => {
						await changeSettingAndRunHandlers({ showLinks });
					}),
			);

		new Setting(containerEl)
			.setName("Show Backlinks")
			.setDesc("Show backlinks to the markdown file.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showBacklinks)
					.onChange(async (showBacklinks) => {
						await changeSettingAndRunHandlers({ showBacklinks });
					}),
			);

		new Setting(containerEl)
			.setName("Backlinks First")
			.setDesc("Show backlinks before links.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.backlinksFirst)
					.onChange(async (backlinksFirst) => {
						await changeSettingAndRunHandlers({ backlinksFirst });
					}),
			);

		new Setting(containerEl)
			.setName("Show Titles")
			.setDesc("Show link title before links.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showLinkTitle)
					.onChange(async (showLinkTitle) => {
						await changeSettingAndRunHandlers({ showLinkTitle });
					}),
			);

		new Setting(containerEl)
			.setName("Separator")
			.setDesc("Separator between links/backlinks.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.separator)
					.onChange(async (separator) => {
						await changeSettingAndRunHandlers({ separator });
					}),
			);

		new Setting(containerEl)
			.setName("Attach Top")
			.setDesc("Always show backlinks and links at the top.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.attachTop)
					.onChange(async (attachTop) => {
						await changeSettingAndRunHandlers({ attachTop });
					}),
			);
	}
}

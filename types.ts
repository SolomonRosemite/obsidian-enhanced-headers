const PREFIX = "my-plugin-";

export const Classes = {
	backlinks: (addPeriod?: boolean) =>
		`${(addPeriod ? "." : "") + PREFIX}backlinks`,
	group: (addPeriod?: boolean) => `${(addPeriod ? "." : "") + PREFIX}group`,
	groupTitle: (addPeriod?: boolean) =>
		`${(addPeriod ? "." : "") + PREFIX}group-title`,

	obsidianCmSizer: (addPeriod?: boolean) => `${addPeriod ? "." : ""}cm-sizer`,
} as const;

export const DEFAULT_SETTINGS: BacklinkPluginSettings = {
	attachTop: false,
	showLinks: false,
	showBacklinks: true,
	separator: "·",
	backlinksFirst: true,
	showLinkTitle: false,
};

export type BacklinkPluginSettings = {
	attachTop: boolean;
	showLinks: boolean;
	showBacklinks: boolean;
	separator: string;
	backlinksFirst: boolean;
	showLinkTitle: boolean;
};

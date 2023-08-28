import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import OpenAI from "openai";

interface PluginSettings {
	apiKey: string;
	statusName: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	apiKey: "",
	statusName: "Definition by AI",
};

export default class ChatGptDefinitions extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "generate-definition",
			name: "Generate Definition",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (view.file) {
					const filename = view.file?.basename;

					let oldFrontmatter =
						this.app.metadataCache.getFileCache(view.file)
							?.frontmatter || {};

					let processedFrontmatter;

					this.app.fileManager.processFrontMatter(
						view.file,
						(frontmatter) => {
							frontmatter["status"] = this.settings.statusName;
							processedFrontmatter = frontmatter;
						}
					);

					if (filename) {
						const originalText = editor.getValue();

						editor.setValue(originalText + "Loading...");
						const definition = await getDefinition(
							filename,
							oldFrontmatter?.tags,
							this.settings.apiKey
						);
						const textWithDefinition = originalText.includes(
							"Loading..."
						)
							? originalText.replace("Loading...", definition)
							: originalText + definition;

						editor.setValue(textWithDefinition);
					}
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: ChatGptDefinitions;

	constructor(app: App, plugin: ChatGptDefinitions) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("API_KEY")
			.setDesc("API Key for OpenAI")
			.addText((text) =>
				text
					.setPlaceholder("Enter your api key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;

						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Status name")
			.setDesc("Status name for generated definitions")
			.addText((text) =>
				text
					.setPlaceholder("Enter your status name")
					.setValue(this.plugin.settings.statusName)
					.onChange(async (value) => {
						this.plugin.settings.statusName = value;

						await this.plugin.saveSettings();
					})
			);
	}
}

async function getDefinition(title: string, tags: string, apiKey: string) {
	const openai = new OpenAI({
		apiKey: apiKey,
		dangerouslyAllowBrowser: true,
	});
	const prompt = `
			Write me one coherent short definition of ${title} in the context of ${tags}.
			Write the definition in a way i can use it for my flashcards.
			`;

	return await openai.chat.completions
		.create({
			messages: [{ role: "user", content: prompt }],
			model: "gpt-3.5-turbo",
		})
		.then((res) => res.choices[0].message.content)
		.catch((err) => err);
}

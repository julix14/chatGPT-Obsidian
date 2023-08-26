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

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: "",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "generate-definition-command",
			name: "Generate Definition",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (view) {
					const filename = view.file?.basename;
					const metadata = this.app.metadataCache.getFileCache(
						view.file || new TFile()
					)?.frontmatter;

					const tags = metadata?.tags.split(",") || [];

					if (filename) {
						const originalText = editor.getValue();

						editor.setValue(originalText + "Loading...");

						const definition = await getDefinition(
							filename,
							tags,
							this.settings.apiKey
						);

						editor.setValue(originalText + definition);
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
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
						console.log("Secret: " + value);

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

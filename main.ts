import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import OpenAI from "openai";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	apiKey: string;
	statusName: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: "",
	statusName: "Definition by AI",
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

					const matches = editor
						.getValue()
						.match(/---(.*?)---/gs) || [""];
					const lines = matches[0]
						.split("\n")
						.filter((line: string) => !line.startsWith("---"));

					const metadata: { [key: string]: string } = {};
					for (const line of lines) {
						const [key, value] = line
							.split(":")
							.map((part) => part.trim());
						metadata[key as string] = value;
					}

					const tags = metadata["tags"];
					const status = this.settings.statusName;

					let metadataString = "---\n";
					let statusSet = metadata["status"] !== undefined;

					if (typeof metadata === "object") {
						for (const [key, value] of Object.entries(metadata)) {
							if (typeof value !== "object") {
								if (key === "status" && statusSet === false) {
									statusSet = true;
									metadataString += `${key}: ${status}\n`;
								}
								metadataString += `${key}: ${value}\n`;
							}
						}
					}
					if (!statusSet) {
						metadataString += `status: ${status}\n`;
					}
					metadataString += "---\n";

					if (filename) {
						const originalText = editor.getValue();

						let processedText = originalText.replace(
							/---.*?---/gs,
							""
						);
						const definition = await getDefinition(
							filename,
							tags,
							this.settings.apiKey
						);

						processedText = metadataString + processedText;

						editor.setValue(originalText + "Loading...");

						editor.setValue(processedText + definition);
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

						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Status Name")
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

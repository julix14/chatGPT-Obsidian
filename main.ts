import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
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

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (view) {
					const filename = view.file?.basename;
					const metadata = this.app.metadataCache.getFileCache(
						view.file || new TFile()
					)?.frontmatter;

					const tags = metadata?.tags.split(",") || [];

					if (filename) {
						console.log("loading definition");
						const definition = await getDefinition(
							filename,
							tags,
							this.settings.apiKey
						);

						editor.setValue(editor.getValue() + definition);
					}
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
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

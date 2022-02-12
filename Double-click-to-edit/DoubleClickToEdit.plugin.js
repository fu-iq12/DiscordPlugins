/**
 * @name DoubleClickToEdit
 * @author Farcrada
 * @version 9.3.1
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */


const config = {
	info: {
		name: "Double Click To Edit",
		id: "DoubleClickToEdit",
		description: "Double click a message you wrote to quickly edit it",
		version: "9.3.1",
		author: "Farcrada",
		updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js"
	}
}


class DoubleClickToEdit {

	//I like my spaces. 
	getName() { return config.info.name; }
	getAuthor() { return `${config.info.author}, original idea by Jiiks`; }


	load() {
		try {
			global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
		}
		catch (err) {
			console.error(this.getName(), "Plugin Updater could not be reached.", err);
		}
	}

	start() {
		try {
			//Classes
			this.selectedClass = BdApi.findModuleByProps("message", "selected").selected;
			this.messagesWrapper = BdApi.findModuleByProps("empty", "messagesWrapper").messagesWrapper;

			//Reply functions
			this.replyToMessage = BdApi.findModuleByProps("replyToMessage").replyToMessage;
			this.getChannel = BdApi.findModuleByProps("getChannel", "getDMFromUserId").getChannel;

			//Stores
			this.MessageStore = BdApi.findModuleByProps("receiveMessage", "editMessage");
			this.CurrentUserStore = BdApi.findModuleByProps("getCurrentUser");

			//Settings
			this.SwitchItem = BdApi.findModuleByDisplayName("SwitchItem");

			//Events
			document.addEventListener('dblclick', this.doubleclickFunc);

			this.doubleClickToReplySetting = BdApi.loadData(config.info.id, "doubleClickToReplySetting") ?? false;
		}
		catch (err) {
			try {
				console.error("Attempting to stop after starting error...", err)
				this.stop();
			}
			catch (err) {
				console.error(this.getName() + ".stop()", err);
			}
		}
	}

	//By doing this we make sure we're able to remove our event
	//otherwise it gets stuck on the page and never actually unloads.
	doubleclickFunc = (e) => this.handler(e);

	stop = () => document.removeEventListener('dblclick', this.doubleclickFunc);

	getSettingsPanel() {
		//Anonymous function to preserve the this scope,
		//which also makes it an anonymous functional component;
		//Pretty neat.
		return () => {
			//Since inherently when you toggle something you need to know what you're toggling from
			//because of this instead of using useState you'd use useReducer
			const [state, dispatch] = BdApi.React.useReducer(currentState => {
				//This runs when you flick the switch
				//Starting with reversing the current state:
				const newState = !currentState;

				//Saving the new state
				this.doubleClickToReplySetting = newState;
				BdApi.saveData(config.info.id, "doubleClickToReplySetting", newState);

				//Returning the new state
				return newState;

				//Default value
			}, this.doubleClickToReplySetting)

			return BdApi.React.createElement(this.SwitchItem, {
				//The state that is loaded with the default value
				value: state,
				note: "Enable to double click another's message and start replying.",
				//Since onChange passes the current state we can simply invoke it as such
				onChange: dispatch
				//Discord Is One Of Those
			}, "Enable Replying");
		}
	}

	handler(e) {
		//Check if we're not double clicking a video
		if (e.target.className.startsWith("video"))
			return;

		//Target the message
		const messageDiv = e.target.closest('li > [class^=message]');
		//If it finds nothing, null it.
		if (!messageDiv)
			return;
		//Make sure we're not resetting when the message is already in edit-mode.
		if (messageDiv.classList.contains(this.selectedClass))
			return;

		//Basically make a HTMLElement/Node interactable with it's React components.
		const instance = BdApi.getInternalInstance(messageDiv);
		//Mandatory nullcheck
		if (!instance)
			return;


		//This is filled with the message top to bottom,
		//if it has a quote the quote will be "message".
		let message = this.getValueFromKey(instance, "message");
		//As a result, this will be the actual message you want to edit.
		const baseMessage = this.getValueFromKey(instance, "baseMessage"),

			//Check if the quote or standalone message is yours.
			msgYours = this.isMessageYours(message, this.CurrentUserStore.getCurrentUser().id),
			//If double clicked a message with a quote, check if the "base"-message is yours.
			baseMsgYours = this.isMessageYours(baseMessage, this.CurrentUserStore.getCurrentUser().id);

		//Message(/quote) is yours
		if (msgYours) {
			//Maybe it is a quote, so check the base message (if it exists)
			if (baseMsgYours)
				message = baseMessage;
			//This can also be "undefined", so a simple !baseMsgYours is not gonna work.
			else if (baseMsgYours == false)
				return this.doubleClickToReplySetting ? this.replyToMessage(this.getChannel(message.channel_id), message, e) : null;
		}
		//Message(/quote) isn't yours
		else if (!msgYours) {
			message = baseMessage ?? message;
			//Maybe the base message is yours
			if (!baseMsgYours)
				return this.doubleClickToReplySetting ? this.replyToMessage(this.getChannel(message.channel_id), message, e) : null;
		}

		//If anything was yours;
		//Execute order 66
		this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
	}

	isMessageYours(message, id) {
		//If message is falsely
		if (!message)
			return undefined;
		//If it's us
		if (message.author.id === id)
			return true;
		//But if it's not!
		return false;
	}

	getValueFromKey(instance, searchkey) {
		//Where we want to search.
		const whitelist = {
			memoizedProps: true,
			child: true,
			sibling: true
		};

		return function getKey(instance) {
			//Pre-define
			let result = undefined;
			//Make sure it exists and isn't a "paradox".
			if (instance && !Node.prototype.isPrototypeOf(instance)) {
				//Get our own keys
				const keys = Object.getOwnPropertyNames(instance);
				//As long as we don't have a result, lets go through.
				for (let i = 0; result === undefined && i < keys.length; i++) {
					//Store our key for readability
					const key = keys[i];
					//Check if there is a key
					if (key) {
						//Store the value
						const value = instance[key];
						//Is our key what we want?
						if (searchkey === key)
							result = value;
						//Otherwise check if the value of a key is something we can search through
						//and whitelisted; of course.
						else if ((typeof value === "object" || typeof value === "function") &&
							(whitelist[key] || key[0] == "." || !isNaN(key[0])))
							//Lets go nesting; lets go!
							result = getKey(value);
					}
				}
			}
			//If a poor sod got found this will not be `undefined`
			return result;

			//Start our mayhem
		}(instance);
	}
}

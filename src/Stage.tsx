import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";

/* ================= EDIT THIS SECTION ================= */

// One entry per character: every name or nickname that should count,
// and the direct link to their image.
const PORTRAITS: { names: string[]; image: string }[] = [
    { names: ["Sakura"], image: "https://file.garden/aojcFZQDGySHCznH/Sakura.jpg" },
    { names: ["Kana"],   image: "https://file.garden/aojcFZQDGySHCznH/Kana.jpg" },
    { names: ["Yuki"],   image: "https://file.garden/aojcFZQDGySHCznH/Yuki.jpg" },
    { names: ["Aoi"],    image: "https://file.garden/aojcFZQDGySHCznH/Aoi.jpg" },
    { names: ["Mika"],   image: "https://file.garden/aojcFZQDGySHCznH/Mika.jpg" },
    { names: ["Rina"],   image: "https://file.garden/aojcFZQDGySHCznH/Rina.jpg" },
];

// The styling applied to every portrait.
const IMG_STYLE = "float:right; margin:0 0 10px 10px; width:50%; border-radius:12px;";

// true:  a portrait shows the first time you name a character in a scene.
// false: a portrait shows every time you name a character.
const ONCE_PER_SCENE = true;

// With ONCE_PER_SCENE on: how many of your messages a character must go
// unnamed before naming them again counts as a new entrance.
const ABSENCE_THRESHOLD = 6;

// Type this anywhere in your message to start a new scene.
// Everyone's portrait will show again the next time you name them.
const SCENE_MARKER = "[scene]";

/* ===================================================== */

type MessageStateType = {
    turn: number;
    lastSeen: { [key: string]: number };
};
type ConfigType = any;
type InitStateType = any;
type ChatStateType = any;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS = PORTRAITS.map(p => ({
    key: p.names[0],
    image: p.image,
    regex: new RegExp(`\\b(${p.names.map(escapeRegex).join("|")})\\b`, "i"),
}));

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    state: MessageStateType;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        this.state = data.messageState ?? { turn: 0, lastSeen: {} };
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return { success: true, error: null, initState: null, chatState: null };
    }

    async setState(state: MessageStateType): Promise<void> {
        // Called on swipes and jumps: restore the state saved with that message.
        if (state != null) {
            this.state = { turn: state.turn ?? 0, lastSeen: { ...(state.lastSeen ?? {}) } };
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        let content = userMessage.content;
        let modifiedMessage: string | null = null;
        let lastSeen = { ...this.state.lastSeen };
        const turn = this.state.turn + 1;

        if (content.toLowerCase().includes(SCENE_MARKER)) {
            // New scene: forget who has appeared, and remove the marker
            // so the model never sees it.
            lastSeen = {};
            content = content.replace(new RegExp(escapeRegex(SCENE_MARKER), "gi"), "").trim();
            modifiedMessage = content;
        }

        const images: string[] = [];

        for (const p of PATTERNS) {
            if (p.regex.test(content)) {
                const previous = lastSeen[p.key];
                const isEntrance =
                    !ONCE_PER_SCENE ||
                    previous === undefined ||
                    turn - previous > ABSENCE_THRESHOLD;

                if (isEntrance) {
                    images.push(`<img src="${p.image}" alt="${p.key}" style="${IMG_STYLE}">`);
                }
                lastSeen[p.key] = turn;
            }
        }

        this.state = { turn, lastSeen };

        return {
            stageDirections: null,
            messageState: this.state,
            modifiedMessage,
            systemMessage: images.length > 0 ? images.join("\n") : null,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        // Bot replies don't trigger portraits; just carry the state forward.
        return {
            stageDirections: null,
            messageState: this.state,
            modifiedMessage: null,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    render(): ReactElement {
        // This stage has no visual panel of its own; it only posts images in the chat.
        return <></>;
    }
}

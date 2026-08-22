export namespace core {
	
	export class PluginManifest {
	    id: string;
	    name: string;
	    version: string;
	    author: string;
	    description: string;
	    kind: string;
	    entry: string;
	    permissions: string[];
	    icon: string;
	    host_min: string;
	
	    static createFrom(source: any = {}) {
	        return new PluginManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.author = source["author"];
	        this.description = source["description"];
	        this.kind = source["kind"];
	        this.entry = source["entry"];
	        this.permissions = source["permissions"];
	        this.icon = source["icon"];
	        this.host_min = source["host_min"];
	    }
	}

}

export namespace main {
	
	export class FascinatorSettings {
	    python: string;
	    app: string;
	    config: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new FascinatorSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.python = source["python"];
	        this.app = source["app"];
	        this.config = source["config"];
	        this.port = source["port"];
	    }
	}

}

export namespace modules {
	
	export class Achievement {
	    id: string;
	    title: string;
	    description: string;
	    unlocked: boolean;
	    unlocked_at?: number;
	
	    static createFrom(source: any = {}) {
	        return new Achievement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.unlocked = source["unlocked"];
	        this.unlocked_at = source["unlocked_at"];
	    }
	}
	export class BoardItem {
	    type: string;
	    value: string;
	    label?: string;
	
	    static createFrom(source: any = {}) {
	        return new BoardItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.value = source["value"];
	        this.label = source["label"];
	    }
	}
	export class Board {
	    id: string;
	    name: string;
	    kind: string;
	    items: BoardItem[];
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Board(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.items = this.convertValues(source["items"], BoardItem);
	        this.updated_at = source["updated_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Bookmark {
	    id: string;
	    title: string;
	    url: string;
	    folder: string;
	    tags: string[];
	    snapshot?: string;
	    dead: boolean;
	    last_check?: number;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Bookmark(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.folder = source["folder"];
	        this.tags = source["tags"];
	        this.snapshot = source["snapshot"];
	        this.dead = source["dead"];
	        this.last_check = source["last_check"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Card {
	    id: string;
	    deck_id: string;
	    front: string;
	    back: string;
	    ease: number;
	    interval_d: number;
	    reps: number;
	    lapses: number;
	    due_at: number;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Card(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.deck_id = source["deck_id"];
	        this.front = source["front"];
	        this.back = source["back"];
	        this.ease = source["ease"];
	        this.interval_d = source["interval_d"];
	        this.reps = source["reps"];
	        this.lapses = source["lapses"];
	        this.due_at = source["due_at"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Deck {
	    id: string;
	    name: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Deck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Department {
	    id: string;
	    name: string;
	    function: string;
	    vision: string;
	    color: string;
	    sort_order: number;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Department(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.function = source["function"];
	        this.vision = source["vision"];
	        this.color = source["color"];
	        this.sort_order = source["sort_order"];
	        this.created_at = source["created_at"];
	    }
	}
	export class DetectiveEdge {
	    id: string;
	    from_id: string;
	    to_id: string;
	    relation: string;
	
	    static createFrom(source: any = {}) {
	        return new DetectiveEdge(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.from_id = source["from_id"];
	        this.to_id = source["to_id"];
	        this.relation = source["relation"];
	    }
	}
	export class DetectiveNode {
	    id: string;
	    kind: string;
	    label: string;
	    note: string;
	    x: number;
	    y: number;
	    pinned_ref?: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new DetectiveNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	        this.note = source["note"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.pinned_ref = source["pinned_ref"];
	        this.created_at = source["created_at"];
	    }
	}
	export class DiaryEntry {
	    id: string;
	    day: string;
	    line: string;
	    mood: number;
	    extra: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new DiaryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.day = source["day"];
	        this.line = source["line"];
	        this.mood = source["mood"];
	        this.extra = source["extra"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Episode {
	    title: string;
	    url: string;
	    date?: string;
	
	    static createFrom(source: any = {}) {
	        return new Episode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.date = source["date"];
	    }
	}
	export class Fleeting {
	    id: string;
	    body: string;
	    tags: string[];
	    media_path?: string;
	    promoted_to?: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Fleeting(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.body = source["body"];
	        this.tags = source["tags"];
	        this.media_path = source["media_path"];
	        this.promoted_to = source["promoted_to"];
	        this.created_at = source["created_at"];
	    }
	}
	export class HabitLog {
	    id: string;
	    habit: string;
	    value: number;
	    unit?: string;
	    logged_at: number;
	    note: string;
	
	    static createFrom(source: any = {}) {
	        return new HabitLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.habit = source["habit"];
	        this.value = source["value"];
	        this.unit = source["unit"];
	        this.logged_at = source["logged_at"];
	        this.note = source["note"];
	    }
	}
	export class InstAction {
	    id: string;
	    title: string;
	    dept_id: string;
	    status: string;
	    progress: number;
	    note: string;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new InstAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.dept_id = source["dept_id"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.note = source["note"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Note {
	    id: string;
	    title: string;
	    template: string;
	    body: string;
	    tags: string[];
	    parent_id?: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.template = source["template"];
	        this.body = source["body"];
	        this.tags = source["tags"];
	        this.parent_id = source["parent_id"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class PasswordEntry {
	    id: string;
	    name: string;
	    url?: string;
	    username?: string;
	    password?: string;
	    notes?: string;
	    strength: number;
	    duplicate: boolean;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new PasswordEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.notes = source["notes"];
	        this.strength = source["strength"];
	        this.duplicate = source["duplicate"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Phase {
	    id: string;
	    title: string;
	    dept_id: string;
	    start_at?: number;
	    end_at?: number;
	    milestones: string[];
	    done: boolean;
	    retro: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Phase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.dept_id = source["dept_id"];
	        this.start_at = source["start_at"];
	        this.end_at = source["end_at"];
	        this.milestones = source["milestones"];
	        this.done = source["done"];
	        this.retro = source["retro"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Podcast {
	    id: string;
	    title: string;
	    url: string;
	    last_fetch: number;
	    episodes: Episode[];
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Podcast(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.last_fetch = source["last_fetch"];
	        this.episodes = this.convertValues(source["episodes"], Episode);
	        this.created_at = source["created_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Pomodoro {
	    id: string;
	    task: string;
	    duration_s: number;
	    started_at: number;
	    ended_at: number;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new Pomodoro(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.task = source["task"];
	        this.duration_s = source["duration_s"];
	        this.started_at = source["started_at"];
	        this.ended_at = source["ended_at"];
	        this.kind = source["kind"];
	    }
	}
	export class Shortcut {
	    id: string;
	    label: string;
	    target: string;
	    group_id?: string;
	    icon?: string;
	    pinned: boolean;
	    open_count: number;
	    last_open?: number;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Shortcut(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.target = source["target"];
	        this.group_id = source["group_id"];
	        this.icon = source["icon"];
	        this.pinned = source["pinned"];
	        this.open_count = source["open_count"];
	        this.last_open = source["last_open"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Subscription {
	    id: string;
	    name: string;
	    cost: number;
	    cycle: string;
	    next_at: number;
	    note: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Subscription(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.cost = source["cost"];
	        this.cycle = source["cycle"];
	        this.next_at = source["next_at"];
	        this.note = source["note"];
	        this.created_at = source["created_at"];
	    }
	}
	export class TimeBlock {
	    id: string;
	    day: string;
	    label: string;
	    start: string;
	    end: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new TimeBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.day = source["day"];
	        this.label = source["label"];
	        this.start = source["start"];
	        this.end = source["end"];
	        this.color = source["color"];
	    }
	}
	export class Todo {
	    id: string;
	    title: string;
	    list: string;
	    due_at?: number;
	    reminder_at?: number;
	    repeat?: string;
	    done: boolean;
	    important: boolean;
	    tags: string[];
	    notes: string;
	    parent_id?: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Todo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.list = source["list"];
	        this.due_at = source["due_at"];
	        this.reminder_at = source["reminder_at"];
	        this.repeat = source["repeat"];
	        this.done = source["done"];
	        this.important = source["important"];
	        this.tags = source["tags"];
	        this.notes = source["notes"];
	        this.parent_id = source["parent_id"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Track {
	    path: string;
	    name: string;
	    artist?: string;
	    ext: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.artist = source["artist"];
	        this.ext = source["ext"];
	        this.size = source["size"];
	    }
	}
	export class Transaction {
	    id: string;
	    amount: number;
	    currency: string;
	    category: string;
	    account: string;
	    note: string;
	    occurred_at: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new Transaction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.amount = source["amount"];
	        this.currency = source["currency"];
	        this.category = source["category"];
	        this.account = source["account"];
	        this.note = source["note"];
	        this.occurred_at = source["occurred_at"];
	        this.source = source["source"];
	    }
	}
	export class TravelEntry {
	    id: string;
	    trip_id: string;
	    title: string;
	    body: string;
	    mood: number;
	    spend: number;
	    lat?: number;
	    lng?: number;
	    photos: string[];
	    logged_at: number;
	
	    static createFrom(source: any = {}) {
	        return new TravelEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.trip_id = source["trip_id"];
	        this.title = source["title"];
	        this.body = source["body"];
	        this.mood = source["mood"];
	        this.spend = source["spend"];
	        this.lat = source["lat"];
	        this.lng = source["lng"];
	        this.photos = source["photos"];
	        this.logged_at = source["logged_at"];
	    }
	}
	export class Trip {
	    id: string;
	    title: string;
	    start_at: number;
	    end_at?: number;
	    note: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Trip(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.start_at = source["start_at"];
	        this.end_at = source["end_at"];
	        this.note = source["note"];
	        this.created_at = source["created_at"];
	    }
	}
	export class WritingSession {
	    id: string;
	    day: string;
	    words: number;
	    note: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new WritingSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.day = source["day"];
	        this.words = source["words"];
	        this.note = source["note"];
	        this.created_at = source["created_at"];
	    }
	}

}


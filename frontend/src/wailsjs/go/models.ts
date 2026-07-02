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

export namespace modules {
	
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

}


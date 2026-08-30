import type {
    CreateProjectInput,
    Project,
    UpdateProjectInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { ProjectService } from '$lib/services/projectService';
import { websocketService } from '$lib/services/websocketService';
import { EntityStore } from './entityStore.svelte';

const projectService = new ProjectService(container.httpClient);

class ProjectStore extends EntityStore<Project, CreateProjectInput, UpdateProjectInput> {
    #messageUnsubscribe: (() => void) | null = null;

    constructor() {
        super(projectService);
    }

    get projects(): Project[] {
        return this.items;
    }

    initWebSocket(): void {
        this.#messageUnsubscribe = websocketService.onServerMessage((message: WsServerMessage) => {
            switch (message.type) {
                case 'project:created':
                    if (message.payload.project) {
                        this.items = [...this.items, message.payload.project];
                    }
                    break;
                case 'project:updated':
                    if (message.payload.project) {
                        this.items = this.items.map(p =>
                            p.id === message.payload.project.id ? message.payload.project : p,
                        );
                    }
                    break;
                case 'project:deleted':
                    this.items = this.items.filter(p => p.id !== message.payload.id);
                    break;
            }
        });
    }

    destroyWebSocket(): void {
        this.#messageUnsubscribe?.();
        this.#messageUnsubscribe = null;
    }
}

export const projectStore = new ProjectStore();

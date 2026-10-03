import type {
    CreateProjectInput,
    Project,
    UpdateProjectInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { ProjectService } from '$lib/services/projectService';
import { EntityStore } from './entityStore.svelte';

const projectService = new ProjectService(container.httpClient);

class ProjectStore extends EntityStore<Project, CreateProjectInput, UpdateProjectInput> {
    constructor() {
        super(projectService);
    }

    get projects(): Project[] {
        return this.items;
    }

    protected override onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'project:created':
                if (message.payload.project) {
                    this.upsert(message.payload.project);
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
    }
}

export const projectStore = new ProjectStore();

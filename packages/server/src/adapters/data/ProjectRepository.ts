import type { CreateProjectInput, Project, UpdateProjectInput } from '@erledigen/shared';

/**
 * Repository interface for Project persistence
 */
export interface ProjectRepository {
    findAll(): Promise<Project[]>;
    findActive(): Promise<Project[]>;
    findById(id: string): Promise<Project | null>;
    create(input: CreateProjectInput): Promise<Project>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  projects, verbatim (ids and timestamps kept). */
    replaceAll(projects: Project[]): Promise<void>;
    update(id: string, input: UpdateProjectInput): Promise<Project | null>;
    delete(id: string): Promise<boolean>;
}

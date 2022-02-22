import { fetchWithTimeout, rpc } from './rpc';
import { Playground, Pool, Workspace, WorkspaceConfiguration, WorkspaceUpdateConfiguration, User, UserConfiguration, UserUpdateConfiguration, Repository, RepositoryConfiguration, RepositoryUpdateConfiguration, RepositoryVersion, RepositoryVersionConfiguration, SessionConfiguration, Session, SessionUpdateConfiguration, Template, } from './types';

export class Client {

    static userResource = 'user';
    static usersResource = 'users';
    static workspaceResource = 'workspace';
    static workspacesResource = 'workspaces';
    static sessionResource = 'session';
    static sessionsResource = 'sessions';
    static repositoriesResource = 'repositories';
    static templatesResource = 'templates';
    static poolsResource = 'pools';

    private readonly base: string;
    private readonly defaultTimeout: number;
    private readonly defaultInit: RequestInit;

    constructor(base: string, defaultTimeout: number = 10000, defaultInit: RequestInit = {}) {
        this.base = base;
        this.defaultInit = defaultInit;
        this.defaultTimeout = defaultTimeout;
    }

    // Login
    async login(bearer: string, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit) {
        const response = await fetchWithTimeout(`${this.path('login')}?bearer=${bearer}`, init, timeout);
        const headers = this.defaultInit.headers;
        if (headers instanceof Headers) {
            throw Error('Unsupported headers type');
        }
        this.defaultInit.headers = {
            cookie: response.headers.get('set-cookie'),
            ...headers
        };
    }

    async logout(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit) {
        await fetchWithTimeout(this.path('logout'), init, timeout);
        const headers = this.defaultInit.headers;
        if (headers instanceof Headers) {
            throw Error('Unsupported headers type');
        }
        delete headers['cookie'];
        this.defaultInit.headers = headers;
    }

    path(...resources: string[]): string {
        return [this.base, ...resources].join("/");
    }

    loginPath(queryParams: string = window.location.search): string {
        return this.path(`login/github${queryParams}`);
    }

    async get(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Playground> {
        return rpc(this.path(""), init, timeout);
    }

    // Current User

    async getCurrentUser(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<User> {
        return rpc(this.path(Client.userResource), {
            ...init
        }, timeout);
    }

    // Users

    async getUser(id: User['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<User | null> {
        return rpc(this.path(Client.usersResource, id), init, timeout);
    }

    async listUsers(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<User[]> {
        return rpc(this.path(Client.usersResource), init, timeout);
    }

    async createUser(id: User['id'], conf: UserConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.usersResource, id), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateUser(id: User['id'], conf: UserUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.usersResource, id), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteUser(id: User['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.usersResource, id), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Current Workspace

    async getCurrentWorkspace(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Workspace | null> {
        return rpc(this.path(Client.workspaceResource), init, timeout);
    }

    async createCurrentWorkspace(conf: WorkspaceConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspaceResource), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateCurrentWorkspace(conf: WorkspaceUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspaceResource), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteCurrentWorkspace(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspaceResource), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Workspaces

    async getWorkspace(id: Workspace['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Workspace | null> {
        return rpc(this.path(Client.workspacesResource, id), init, timeout);
    }

    async listWorkspaces(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Workspace[]> {
        return rpc(this.path(Client.workspacesResource), init, timeout);
    }

    async createWorkspace(id: Workspace['id'], conf: WorkspaceConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspacesResource, id), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateWorkspace(id: Workspace['id'], conf: WorkspaceUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspacesResource, id), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteWorkspace(id: Workspace['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.workspacesResource, id), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Current Session

    async getCurrentSession(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Session | null> {
        return rpc(this.path(Client.sessionResource), init, timeout);
    }

    async createCurrentSession(conf: SessionConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionResource), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateCurrentSession(conf: SessionUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionResource), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteCurrentSession(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionResource), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Sessions

    async getSession(id: string, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Session | null> {
        return rpc(this.path(Client.sessionsResource, id), init, timeout);
    }

    async listSessions(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Session[]> {
        return rpc(this.path(Client.sessionsResource), init, timeout);
    }

    async createSession(id: string, conf: SessionConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionsResource, id), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateSession(id: string, conf: SessionUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionsResource, id), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteSession(id: string, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.sessionsResource, id), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Repositories

    async getRepository(id: Repository['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Repository | null> {
        return rpc(this.path(Client.repositoriesResource, id), init, timeout);
    }

    async listRepositories(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Repository[]> {
        return rpc(this.path(Client.repositoriesResource), init, timeout);
    }

    async createRepository(id: Repository['id'], conf: RepositoryConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.repositoriesResource, id), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async updateRepository(id: Repository['id'], conf: RepositoryUpdateConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.repositoriesResource, id), {
            method: 'PATCH',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteRepository(id: Repository['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.repositoriesResource, id), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    async getRepositoryVersion(id: Repository['id'], version: string, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<RepositoryVersion | null> {
        return rpc(this.path(Client.repositoriesResource, id, 'versions', version), init, timeout);
    }

    async listRepositoryVersions(id: Repository['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<RepositoryVersion[]> {
        return rpc(this.path(Client.repositoriesResource, id, 'versions'), init, timeout);
    }

    async createRepositoryVersion(id: Repository['id'], version: string, conf: RepositoryVersionConfiguration, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.repositoriesResource, id, 'versions', version), {
            method: 'PUT',
            body: JSON.stringify(conf),
            ...init
        }, timeout);
    }

    async deleteRepositoryVersion(id: Repository['id'], version: string, timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<void> {
        return rpc(this.path(Client.repositoriesResource, id, 'versions', version), {
            method: 'DELETE',
            ...init
        }, timeout);
    }

    // Templates

    async listTemplates(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Template[]> {
        return rpc(this.path(Client.templatesResource), init, timeout);
    }

    // Pools

    async getPool(id: Pool['id'], timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Pool | null> {
        return rpc(this.path(Client.poolsResource, id), init, timeout);
    }

    async listPools(timeout: number = this.defaultTimeout, init: RequestInit = this.defaultInit): Promise<Pool[]> {
        return rpc(this.path(Client.poolsResource), init, timeout);
    }

}

export * from "./auth";
export * from "./rpc";
export * from "./workspace";
export * from "./types";
export * from "./utils";

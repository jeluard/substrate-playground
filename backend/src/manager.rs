/// Abstracts k8s interaction by handling permissions, logging, etc..
///
use crate::{
    error::{Error, Result},
    kubernetes::{
        get_configuration,
        pool::{get_pool, list_pools},
        repository::{
            create_repository, create_repository_version, delete_repository,
            delete_repository_version, get_repository, get_repository_version, list_repositories,
            list_repository_versions, update_repository,
        },
        role::{create_role, delete_role, get_role, list_roles, update_role},
        session::{
            create_session, create_session_execution, delete_session, get_session, list_sessions,
            patch_ingress, update_session,
        },
        user::{create_user, delete_user, get_user, list_users, update_user},
    },
    metrics::Metrics,
    types::{
        Playground, Pool, Repository, RepositoryConfiguration, RepositoryUpdateConfiguration,
        RepositoryVersion, ResourcePermission, ResourceType, Role, RoleConfiguration, Session,
        SessionConfiguration, SessionExecution, SessionExecutionConfiguration, SessionState,
        SessionUpdateConfiguration, User, UserConfiguration, UserUpdateConfiguration,
    },
};
use log::{error, info, warn};
use std::{
    thread::{self, JoinHandle},
    time::Duration,
};

#[derive(Clone)]
pub struct Manager {
    pub metrics: Metrics,
}

impl Manager {
    const SLEEP_TIME: Duration = Duration::from_secs(60);

    pub async fn new() -> Result<Self> {
        let metrics = Metrics::new()?;
        // Go through all existing sessions and update the ingress
        // TODO remove once migrated to per session nginx
        match list_sessions().await {
            Ok(sessions) => {
                let running = sessions
                    .iter()
                    .flat_map(|i| match &i.state {
                        SessionState::Running { .. } => Some((i.id.clone(), vec![])),
                        _ => None,
                    })
                    .collect();
                if let Err(err) = patch_ingress(&running).await {
                    error!(
                        "Failed to patch ingress: {}. Existing sessions won't be accessible",
                        err
                    )
                } else if running.is_empty() {
                    info!("No sesssions restored");
                } else {
                    info!("Restored sesssions for {:?}", running.keys());
                }
            }
            Err(err) => error!(
                "Failed to list sessions: {}. Existing sessions won't be accessible",
                err
            ),
        }
        Ok(Manager { metrics })
    }

    pub async fn spawn_session_reaper_thread(
        &self,
    ) -> Result<JoinHandle<impl std::future::Future>> {
        Ok(thread::spawn(async move || loop {
            thread::sleep(Manager::SLEEP_TIME);

            // Go through all Running pods and figure out if they have to be undeployed
            if let Ok(sessions) = list_sessions().await {
                for session in sessions {
                    if let SessionState::Running { start_time, .. } = session.state {
                        if let Ok(duration) = start_time.elapsed() {
                            if duration > session.max_duration {
                                info!(
                                    "Undeploying {} after {} mins (target {})",
                                    session.user_id,
                                    duration.as_secs() / 60,
                                    session.max_duration.as_secs() / 60
                                );

                                // Finally delete the session
                                let session = session.clone();
                                let sid = session.id;
                                let id = sid.as_str();
                                if let Err(err) = delete_session(&session.user_id, id).await {
                                    warn!("Error while undeploying {}: {}", id, err)
                                }
                            }
                        }
                    }
                }
            } else {
                error!("Failed to call list_sessions")
            }
        }))
    }
}

async fn ensure_permission(
    caller: &User,
    resource_type: ResourceType,
    resource_permission: ResourcePermission,
) -> Result<()> {
    if !caller
        .has_permission(&resource_type, &resource_permission)
        .await
    {
        return Err(Error::Unauthorized(resource_type, resource_permission));
    }

    Ok(())
}

impl Manager {
    pub async fn get(self, user: User) -> Result<Playground> {
        Ok(Playground {
            user: Some(user),
            configuration: get_configuration().await?,
        })
    }

    pub async fn get_unlogged(&self) -> Result<Playground> {
        Ok(Playground {
            user: None,
            configuration: get_configuration().await?,
        })
    }

    // Users

    pub async fn get_user(&self, caller: &User, id: &str) -> Result<Option<User>> {
        // Users can get details about themselves
        if caller.id != id {
            ensure_permission(caller, ResourceType::User, ResourcePermission::Read).await?;
        }

        get_user(id).await
    }

    pub async fn list_users(&self, caller: &User) -> Result<Vec<User>> {
        ensure_permission(caller, ResourceType::User, ResourcePermission::Read).await?;

        list_users().await
    }

    pub async fn create_user(
        self,
        caller: &User,
        id: String,
        conf: UserConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::User, ResourcePermission::Create).await?;

        create_user(&id, conf).await
    }

    pub async fn update_user(
        self,
        caller: &User,
        id: String,
        conf: UserUpdateConfiguration,
    ) -> Result<()> {
        // Users can edit themselves
        if caller.id != id {
            ensure_permission(caller, ResourceType::User, ResourcePermission::Update).await?;
        }

        update_user(&id, conf).await
    }

    pub async fn delete_user(self, caller: &User, id: String) -> Result<()> {
        // Users can delete themselves
        if caller.id != id {
            ensure_permission(caller, ResourceType::User, ResourcePermission::Delete).await?;
        }

        delete_user(&id).await
    }
    // Roles

    pub async fn get_role(&self, caller: &User, id: &str) -> Result<Option<Role>> {
        ensure_permission(caller, ResourceType::Role, ResourcePermission::Read).await?;

        get_role(id).await
    }

    pub async fn list_roles(&self, caller: &User) -> Result<Vec<Role>> {
        ensure_permission(
            caller,
            ResourceType::Role,
            crate::types::ResourcePermission::Read,
        )
        .await?;

        list_roles().await
    }

    pub async fn create_role(
        &self,
        caller: &User,
        id: &str,
        conf: RoleConfiguration,
    ) -> Result<()> {
        ensure_permission(
            caller,
            ResourceType::Role,
            crate::types::ResourcePermission::Create,
        )
        .await?;

        create_role(id, conf).await
    }

    pub async fn update_role(
        &self,
        caller: &User,
        id: &str,
        conf: crate::types::RoleUpdateConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::Role, ResourcePermission::Update).await?;

        update_role(id, conf).await
    }

    pub async fn delete_role(&self, caller: &User, id: &str) -> Result<()> {
        ensure_permission(caller, ResourceType::Role, ResourcePermission::Delete).await?;

        delete_role(id).await
    }

    // Repositories

    pub async fn get_repository(&self, caller: &User, id: &str) -> Result<Option<Repository>> {
        ensure_permission(caller, ResourceType::Repository, ResourcePermission::Read).await?;

        get_repository(id).await
    }

    pub async fn list_repositories(&self, caller: &User) -> Result<Vec<Repository>> {
        ensure_permission(caller, ResourceType::Repository, ResourcePermission::Read).await?;

        list_repositories().await
    }

    pub async fn create_repository(
        &self,
        caller: &User,
        id: &str,
        conf: RepositoryConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::Repository, ResourcePermission::Create).await?;

        create_repository(id, conf).await
    }

    pub async fn update_repository(
        &self,
        caller: &User,
        id: &str,
        conf: RepositoryUpdateConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::Repository, ResourcePermission::Update).await?;

        update_repository(id, conf).await
    }

    pub async fn delete_repository(&self, caller: &User, id: &str) -> Result<()> {
        ensure_permission(caller, ResourceType::Repository, ResourcePermission::Delete).await?;

        delete_repository(id).await
    }

    //Repository versions

    pub async fn get_repository_version(
        &self,
        caller: &User,
        repository_id: &str,
        id: &str,
    ) -> Result<Option<RepositoryVersion>> {
        ensure_permission(
            caller,
            ResourceType::RepositoryVersion,
            ResourcePermission::Read,
        )
        .await?;

        get_repository_version(&caller.id, repository_id, id).await
    }

    pub async fn list_repository_versions(
        &self,
        caller: &User,
        repository_id: &str,
    ) -> Result<Vec<RepositoryVersion>> {
        ensure_permission(
            caller,
            ResourceType::RepositoryVersion,
            ResourcePermission::Read,
        )
        .await?;

        list_repository_versions(repository_id).await
    }

    pub async fn create_repository_version(
        &self,
        caller: &User,
        repository_id: &str,
        id: &str,
    ) -> Result<()> {
        ensure_permission(
            caller,
            ResourceType::RepositoryVersion,
            ResourcePermission::Create,
        )
        .await?;

        create_repository_version(&caller.id, repository_id, id).await
    }

    pub async fn delete_repository_version(
        &self,
        caller: &User,
        repository_id: &str,
        id: &str,
    ) -> Result<()> {
        ensure_permission(
            caller,
            ResourceType::RepositoryVersion,
            ResourcePermission::Delete,
        )
        .await?;

        delete_repository_version(&caller.id, repository_id, id).await
    }

    // Pools

    pub async fn get_pool(&self, caller: &User, pool_id: &str) -> Result<Option<Pool>> {
        ensure_permission(caller, ResourceType::Pool, ResourcePermission::Read).await?;

        get_pool(pool_id).await
    }

    pub async fn list_pools(&self, caller: &User) -> Result<Vec<Pool>> {
        ensure_permission(caller, ResourceType::Pool, ResourcePermission::Read).await?;

        list_pools().await
    }

    // Sessions

    async fn ensure_session_ownership(&self, user: &User, session_id: &str) -> Result<Session> {
        if let Some(session) = get_session(&user.id, session_id).await? {
            if user.id != session.user_id {
                return Err(Error::ResourceNotOwned(
                    ResourceType::Session,
                    session_id.to_string(),
                ));
            }
            Ok(session)
        } else {
            Err(Error::UnknownResource(
                ResourceType::Session,
                session_id.to_string(),
            ))
        }
    }

    pub async fn get_session(&self, caller: &User, id: &str) -> Result<Option<Session>> {
        ensure_permission(caller, ResourceType::Session, ResourcePermission::Read).await?;

        match self.ensure_session_ownership(caller, id).await {
            Err(failure @ Error::Failure(_)) => Err(failure),
            Err(_) => Ok(None),
            Ok(session) => Ok(Some(session)),
        }
    }

    pub async fn list_sessions(&self, caller: &User) -> Result<Vec<Session>> {
        ensure_permission(caller, ResourceType::Session, ResourcePermission::Read).await?;

        list_sessions().await
    }

    pub async fn create_session(
        &self,
        caller: &User,
        id: &str,
        session_configuration: &SessionConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::Session, ResourcePermission::Create).await?;

        // Session name must match user name, unless User has a specific permission
        if caller.id.to_ascii_lowercase() != id {
            ensure_permission(
                caller,
                ResourceType::Session,
                ResourcePermission::Custom {
                    name: "CustomizeSessionName".to_string(),
                },
            )
            .await?
        }

        if session_configuration.duration.is_some() {
            // Duration can only be customized by users with proper permission
            ensure_permission(
                caller,
                ResourceType::Session,
                ResourcePermission::Custom {
                    name: "CustomizeSessionDuration".to_string(),
                },
            )
            .await?;
        }
        if session_configuration.pool_affinity.is_some() {
            // Pool affinity can only be customized by users with proper permission
            ensure_permission(
                caller,
                ResourceType::Session,
                ResourcePermission::Custom {
                    name: "CustomizeSessionPoolAffinity".to_string(),
                },
            )
            .await?;
        }

        // Check that the session doesn't already exists
        if self.get_session(caller, id).await?.is_some() {
            return Err(Error::SessionIdAlreayUsed);
        }

        let repository_source = session_configuration.clone().repository_source;
        let configuration = get_configuration().await?;
        let result = create_session(caller, id, &configuration, session_configuration).await;

        info!(
            "Created session {} with repository_source {}:{:?}",
            id, repository_source.repository_id, repository_source.repository_version_id
        );

        match &result {
            Ok(_session) => {
                self.metrics.inc_deploy_counter();
            }
            Err(e) => {
                self.metrics.inc_deploy_failures_counter();
                error!("Error during deployment {}", e);
            }
        }
        result
    }

    pub async fn update_session(
        &self,
        caller: &User,
        id: &str,
        session_update_configuration: SessionUpdateConfiguration,
    ) -> Result<()> {
        ensure_permission(caller, ResourceType::Session, ResourcePermission::Update).await?;

        self.ensure_session_ownership(caller, id).await?;

        let configuration = get_configuration().await?;
        update_session(&caller.id, id, configuration, session_update_configuration).await
    }

    pub async fn delete_session(&self, caller: &User, id: &str) -> Result<()> {
        ensure_permission(caller, ResourceType::Session, ResourcePermission::Delete).await?;

        self.ensure_session_ownership(caller, id).await?;

        let result = delete_session(&caller.id, id).await;
        match &result {
            Ok(_) => {
                self.metrics.inc_undeploy_counter();
            }
            Err(e) => {
                self.metrics.inc_undeploy_failures_counter();
                error!("Error during undeployment {}", e);
            }
        }
        result
    }

    // Session executions

    pub async fn create_session_execution(
        &self,
        caller: &User,
        session_id: &str,
        session_execution_configuration: SessionExecutionConfiguration,
    ) -> Result<SessionExecution> {
        ensure_permission(
            caller,
            ResourceType::SessionExecution,
            ResourcePermission::Create,
        )
        .await?;

        self.ensure_session_ownership(caller, session_id).await?;

        create_session_execution(&caller.id, session_id, session_execution_configuration).await
    }
}

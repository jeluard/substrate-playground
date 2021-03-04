use log::{error, info, warn};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashSet},
    error::Error,
    sync::{Arc, Mutex},
    thread::{self, JoinHandle},
    time::Duration,
};
use tokio::runtime::Runtime;

use crate::{
    kubernetes::{Configuration, Engine, Environment},
    metrics::Metrics,
    types::{
        LoggedUser, Phase, Pool, Session, SessionConfiguration, SessionUpdateConfiguration,
        Template, User, UserConfiguration, UserUpdateConfiguration,
    },
};

/*

https://github.com/clux/kube-rs/blob/master/examples/event_watcher.rs
https://github.com/kubesphere/kube-events
https://github.com/heptiolabs/eventrouter
https://github.com/opsgenie/kubernetes-event-exporter
https://github.com/GoogleCloudPlatform/click-to-deploy/blob/master/k8s/prometheus/manifest/prometheus-statefulset.yaml
https://github.com/prometheus-operator/kube-prometheus

*/

fn running_sessions(sessions: Vec<&Session>) -> Vec<&Session> {
    sessions
        .into_iter()
        .filter(|session| session.pod.phase == Phase::Running)
        .collect()
}

#[derive(Clone)]
pub struct Manager {
    pub engine: Engine,
    pub metrics: Metrics,
    sessions: Arc<Mutex<HashSet<String>>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Playground {
    pub env: Environment,
    pub configuration: Configuration,
    pub templates: BTreeMap<String, Template>,
    pub user: Option<LoggedUser>,
}

impl Manager {
    const SLEEP_TIME: Duration = Duration::from_secs(60);

    pub async fn new() -> Result<Self, Box<dyn Error>> {
        let metrics = Metrics::new()?;
        let engine = Engine::new().await?;
        // Go through all existing sessions and update the ingress
        match engine.clone().list_sessions().await {
            Ok(sessions) => {
                let running = running_sessions(sessions.values().collect())
                    .iter()
                    .map(|i| (i.user_id.clone(), &i.template))
                    .collect();
                engine.clone().patch_ingress(&running).await?;

                if running.is_empty() {
                    info!("No sesssions restored");
                } else {
                    info!("Restored sesssions for {:?}", running.keys());
                }
            }
            Err(err) => error!(
                "Failed to call list_all: {}. Existing sessions won't be accessible",
                err
            ),
        }
        Ok(Manager {
            engine,
            metrics,
            sessions: Arc::new(Mutex::new(HashSet::new())), // Temp map used to track session deployment time
        })
    }

    pub fn spawn_background_thread(self) -> JoinHandle<()> {
        thread::spawn(move || loop {
            thread::sleep(Manager::SLEEP_TIME);

            // Track some deployments metrics
            let sessions_thread = self.clone().sessions.clone();
            if let Ok(mut sessions2) = sessions_thread.lock() {
                let sessions3 = &mut sessions2.clone();
                for id in sessions3.iter() {
                    match self.clone().get_session(id) {
                        Ok(Some(session)) => {
                            // Deployed sessions are removed from the set
                            // Additionally the deployment time is tracked
                            match session.pod.phase {
                                Phase::Running | Phase::Failed => {
                                    sessions2.remove(&session.user_id);
                                    if let Some(duration) =
                                        &session.pod.start_time.and_then(|p| p.elapsed().ok())
                                    {
                                        self.clone()
                                            .metrics
                                            .observe_deploy_duration(duration.as_secs_f64());
                                    } else {
                                        error!("Failed to compute this session lifetime");
                                    }
                                }
                                _ => {}
                            }
                        }
                        Err(err) => {
                            warn!("Failed to call get: {}", err);
                            sessions2.remove(id);
                        }
                        Ok(None) => warn!("No matching pod: {}", id),
                    }
                }
            } else {
                error!("Failed to acquire sessions lock");
            }

            // Go through all Running pods and figure out if they have to be undeployed
            match self.clone().list_sessions() {
                Ok(sessions) => {
                    for session in running_sessions(sessions.values().collect()) {
                        if let Some(duration) =
                            &session.pod.start_time.and_then(|p| p.elapsed().ok())
                        {
                            if duration > &session.duration {
                                info!("Undeploying {}", session.user_id);

                                match self.clone().delete_session(&session.user_id) {
                                    Ok(()) => (),
                                    Err(err) => {
                                        warn!(
                                            "Error while undeploying {}: {}",
                                            session.user_id, err
                                        )
                                    }
                                }
                            }
                        } else {
                            error!("Failed to compute this session lifetime");
                        }
                    }
                }
                Err(err) => error!("Failed to call list_all: {}", err),
            }
        })
    }
}

fn new_runtime() -> Result<Runtime, String> {
    Runtime::new().map_err(|err| format!("{}", err))
}

fn session_id(id: &str) -> String {
    // Create a unique ID for this session. Use lowercase to make sure the result can be used as part of a DNS
    id.to_string().to_lowercase()
}

impl Manager {
    pub fn get(self, user: LoggedUser) -> Result<Playground, String> {
        let templates = new_runtime()?.block_on(self.clone().engine.list_templates())?;
        Ok(Playground {
            templates,
            user: Some(user),
            env: self.engine.env,
            configuration: self.engine.configuration,
        })
    }

    pub fn get_unlogged(self) -> Result<Playground, String> {
        let templates = new_runtime()?.block_on(self.clone().engine.list_templates())?;
        Ok(Playground {
            templates,
            user: None,
            env: self.engine.env,
            configuration: self.engine.configuration,
        })
    }

    // Users

    pub fn get_user(self, id: &str) -> Result<Option<User>, String> {
        new_runtime()?.block_on(self.engine.get_user(&id))
    }

    pub fn list_users(self) -> Result<BTreeMap<String, User>, String> {
        new_runtime()?.block_on(self.engine.list_users())
    }

    pub fn create_user(self, id: String, user: UserConfiguration) -> Result<(), String> {
        new_runtime()?.block_on(self.engine.create_user(id, user))
    }

    pub fn update_user(self, id: String, user: UserUpdateConfiguration) -> Result<(), String> {
        new_runtime()?.block_on(self.engine.update_user(id, user))
    }

    pub fn delete_user(self, id: String) -> Result<(), String> {
        new_runtime()?.block_on(self.engine.delete_user(id))
    }

    // Sessions

    pub fn get_session(&self, id: &str) -> Result<Option<Session>, String> {
        new_runtime()?.block_on(self.engine.get_session(&id))
    }

    pub fn list_sessions(&self) -> Result<BTreeMap<String, Session>, String> {
        new_runtime()?.block_on(self.engine.list_sessions())
    }

    pub fn create_session(
        self,
        id: &str,
        user: &LoggedUser,
        conf: SessionConfiguration,
    ) -> Result<(), String> {
        if conf.duration.is_some() {
            // Duration can only customized by users with proper rights
            if !user.can_customize_duration() {
                return Err("Only admin can customize a session duration".to_string());
            }
        }
        if conf.pool_affinity.is_some() {
            // Duration can only customized by users with proper rights
            if !user.can_customize_pool_affinity() {
                return Err("Only admin can customize a session pool affinity".to_string());
            }
        }

        let session_id = session_id(id);
        if self.get_session(&session_id)?.is_some() {
            return Err("A session is already running".to_string());
        }

        let template = conf.clone().template;
        let result = new_runtime()?.block_on(self.engine.create_session(user, &session_id, conf));

        info!("Created session {} with template {}", session_id, template);

        match &result {
            Ok(_session) => {
                if let Ok(mut sessions) = self.sessions.lock() {
                    sessions.insert(session_id);
                } else {
                    error!("Failed to acquire sessions lock");
                }
                self.metrics.inc_deploy_counter(&template);
            }
            Err(e) => {
                self.metrics.inc_deploy_failures_counter(&template);
                error!("Error during deployment {}", e);
            }
        }
        result
    }

    pub fn update_session(
        self,
        id: &str,
        user: &LoggedUser,
        conf: SessionUpdateConfiguration,
    ) -> Result<(), String> {
        if conf.duration.is_some() {
            // Duration can only customized by users with proper rights
            if !user.can_customize_duration() {
                return Err("Only admin can customize a session duration".to_string());
            }
        }
        new_runtime()?.block_on(self.engine.update_session(&session_id(id), conf))
    }

    pub fn delete_session(self, id: &str) -> Result<(), String> {
        let result = new_runtime()?.block_on(self.engine.delete_session(&id));
        match &result {
            Ok(_) => {
                self.metrics.inc_undeploy_counter();
                if let Ok(mut sessions) = self.sessions.lock() {
                    sessions.remove(id);
                } else {
                    error!("Failed to acquire sessions lock");
                }
            }
            Err(e) => {
                self.metrics.inc_undeploy_failures_counter();
                error!("Error during undeployment {}", e);
            }
        }
        result
    }

    // Pools

    pub fn get_pool(self, id: &str) -> Result<Option<Pool>, String> {
        new_runtime()?.block_on(self.engine.get_pool(&id))
    }

    pub fn list_pools(&self) -> Result<BTreeMap<String, Pool>, String> {
        new_runtime()?.block_on(self.clone().engine.list_pools())
    }
}

//! Helper methods ton interact with k8s
use crate::{
    error::{Error, Result},
    types::{
        Repository, RepositoryConfiguration, RepositoryUpdateConfiguration, RepositoryVersion,
        RepositoryVersionState, ResourceType,
    },
};
use k8s_openapi::api::{
    batch::v1::{Job, JobSpec},
    core::v1::{
        Container, PersistentVolumeClaim, PersistentVolumeClaimSpec,
        PersistentVolumeClaimVolumeSource, PodSpec, PodTemplateSpec, ResourceRequirements, Volume,
        VolumeMount,
    },
};
use k8s_openapi::apimachinery::pkg::{api::resource::Quantity, apis::meta::v1::ObjectMeta};
use kube::{
    api::{Api, PostParams},
    Resource,
};
use std::collections::BTreeMap;

use super::{
    client, delete_config_map_value, get_resource_from_config_map, list_resources_from_config_map,
    store_resource_as_config_map,
};

const APP_LABEL: &str = "app.kubernetes.io/part-of";
const APP_VALUE: &str = "playground";
const COMPONENT_LABEL: &str = "app.kubernetes.io/component";

const COMPONENT_WORKSPACE_VALUE: &str = "workspace";

const CONFIG_MAP: &str = "playground-repositories";

fn volume_template(volume_template_name: &str, _repository_id: &str) -> PersistentVolumeClaim {
    let mut labels = BTreeMap::new();
    labels.insert(APP_LABEL.to_string(), APP_VALUE.to_string());
    labels.insert(
        COMPONENT_LABEL.to_string(),
        COMPONENT_WORKSPACE_VALUE.to_string(),
    );

    let mut requests = BTreeMap::new();
    requests.insert("storage".to_string(), Quantity("5Gi".to_string()));

    PersistentVolumeClaim {
        metadata: ObjectMeta {
            name: Some(volume_template_name.to_string()),
            labels: Some(labels),
            ..Default::default()
        },
        spec: Some(PersistentVolumeClaimSpec {
            access_modes: Some(vec!["ReadWriteOnce".to_string()]),
            resources: Some(ResourceRequirements {
                requests: Some(requests),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    }
}

fn volume_template_name(repository_id: &str) -> String {
    format!("workspace-template-{}", repository_id)
}

async fn create_volume_template(
    api: &Api<PersistentVolumeClaim>,
    volume_template_name: &str,
    repository_id: &str,
) -> Result<PersistentVolumeClaim> {
    api.create(
        &PostParams::default(),
        &volume_template(volume_template_name, repository_id),
    )
    .await
    .map_err(Error::K8sCommunicationFailure)
}

pub async fn get_repository(id: &str) -> Result<Option<Repository>> {
    let client = client()?;
    get_resource_from_config_map(&client, id, CONFIG_MAP).await
}

pub async fn list_repositories() -> Result<Vec<Repository>> {
    let client = client()?;
    list_resources_from_config_map(&client, CONFIG_MAP).await
}

pub async fn create_repository(id: &str, conf: RepositoryConfiguration) -> Result<()> {
    let client = client()?;

    let repository = Repository {
        id: id.to_string(),
        url: conf.url,
    };

    store_resource_as_config_map(&client, &repository.id, &repository, CONFIG_MAP).await
}

pub async fn update_repository(id: &str, conf: RepositoryUpdateConfiguration) -> Result<()> {
    let client = client()?;

    let mut repository: Repository = get_resource_from_config_map(&client, id, CONFIG_MAP)
        .await?
        .ok_or_else(|| Error::UnknownResource(ResourceType::Repository, id.to_string()))?;
    repository.url = conf.url;

    store_resource_as_config_map(&client, &repository.id, &repository, CONFIG_MAP).await
}

pub async fn delete_repository(id: &str) -> Result<()> {
    let client = client()?;
    delete_config_map_value(&client, CONFIG_MAP, id).await
}

// Repository versions

pub async fn get_repository_version(
    _repository_id: &str,
    _id: &str,
) -> Result<Option<RepositoryVersion>> {
    // TODO
    Ok(Some(RepositoryVersion {
        id: "".to_string(),
        state: RepositoryVersionState::Cloning { progress: 50 },
    }))
}

pub async fn list_repository_versions(_repository_id: &str) -> Result<Vec<RepositoryVersion>> {
    // TODO list volume template
    Ok(vec![RepositoryVersion {
        id: "yo".to_string(),
        state: RepositoryVersionState::Cloning { progress: 50 },
    }])
}

pub async fn create_repository_version(repository_id: &str, id: &str) -> Result<()> {
    let client = client()?;

    // Create volume
    let volume_api: Api<PersistentVolumeClaim> = Api::default_namespaced(client.clone());
    let volume_template_name = volume_template_name(repository_id);
    let volume = create_volume_template(&volume_api, &volume_template_name, repository_id).await?;

    let job_api: Api<Job> = Api::default_namespaced(client.clone());
    let job = Job {
        metadata: ObjectMeta {
            name: Some(format!("builder-{}-{}", repository_id, id)),
            ..Default::default()
        },
        spec: Some(JobSpec {
            ttl_seconds_after_finished: Some(0),
            backoff_limit: Some(1),
            template: PodTemplateSpec {
                spec: Some(PodSpec {
                    volumes: Some(vec![Volume {
                        name: volume_template_name.clone(),
                        persistent_volume_claim: Some(PersistentVolumeClaimVolumeSource {
                            claim_name: volume
                                .meta()
                                .clone()
                                .name
                                .ok_or(Error::MissingData("meta#name"))?,
                            ..Default::default()
                        }),
                        ..Default::default()
                    }]),
                    restart_policy: Some("OnFailure".to_string()),
                    containers: vec![Container {
                        name: "builder".to_string(),
                        image: Some(
                            // TODO programmatically fetch from current image
                            "paritytech/substrate-playground-backend-api:latest".to_string(),
                        ),
                        command: Some(vec!["builder".to_string()]),
                        args: Some(vec![repository_id.to_string()]),
                        volume_mounts: Some(vec![VolumeMount {
                            name: volume_template_name,
                            mount_path: "/".to_string(),
                            ..Default::default()
                        }]),
                        ..Default::default()
                    }],
                    ..Default::default()
                }),
                ..Default::default()
            },
            ..Default::default()
        }),
        ..Default::default()
    };
    job_api
        .create(&PostParams::default(), &job)
        .await
        .map_err(Error::K8sCommunicationFailure)?;

    Ok(())
}

pub async fn delete_repository_version(_repository_id: &str, _id: &str) -> Result<()> {
    Ok(())
}

// Repository latest version

pub async fn get_repository_latest_version(
    repository_id: &str,
) -> Result<Option<RepositoryVersion>> {
    // TODO
    Ok(Some(RepositoryVersion {
        id: "".to_string(),
        state: RepositoryVersionState::Cloning { progress: 50 },
    }))
}

pub async fn create_repository_latest_version(repository_id: &str, id: &str) -> Result<()> {
    Ok(())
}

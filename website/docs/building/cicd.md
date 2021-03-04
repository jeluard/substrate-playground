---
id: cicd
title: CI/CD
---

`substrate-playground` follows a Continuous Integration/Continuous Delivery approach

## Deployments

### Playground

The main branch is [develop](https://github.com/paritytech/substrate-playground/tree/develop). Changes can be merged only via PR.
[develop](https://github.com/paritytech/substrate-playground/tree/develop) is continuously deployed.

Once manually approved on the staging environment, changes are promoted to master.

### Base template images

### Template images

## Github configuration

### Secrets

A number of `secrets` must be defined:

`DOCKER_USERNAME` and `DOCKER_PASSWORD` pointing to a valid dockerhub account having acccess to paritytech organization

`MATRIX_ACCESS_TOKEN` and `MATRIX_ROOM_ID` pointing to a specific Matrix room

`PAT_TOKEN` a [token](https://help.github.com/en/actions/reference/events-that-trigger-workflows#triggering-new-workflows-using-a-personal-access-token) with `repo` access

### Matrix messages

#### Create a new user

Go to https://riot.im/app/#/register (advanced, https://matrix.parity.io)
Username: `playground-bot`
Email: `julien+playground-bot@parity.io`

Then retrieve `access_token` via `curl -XPOST -d '{"type":"m.login.password", "user":"playground-bot", "password":"PASSWORD"}' "https://matrix.parity.io:8448/_matrix/client/r0/login"` and use it as a Github repository secret.

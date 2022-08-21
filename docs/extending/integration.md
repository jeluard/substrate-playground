---
id: integration
title: Integration
---

## URL based deployment

Use a URL that once accessed trigger an instance deployment and redirects to the newly created theia instance.

### Query parameters

* deploy=`id` where id is a valid template id
* files=%2Fsome%2FfileA,%2Fsome%2FfileB opens some files


e.g. `https://playground-staging.substrate.io/?deploy=recipes&files=%2Fhome%2Fsubstrate%2Fworkspace%2Fpallets%2Fadding-machine%2Fsrc%2Flib.rs`

## API

Instances can be created and destroyed using an HTTP API.

```
GET https://playground-staging.substrate.io/api/
POST https://playground-staging.substrate.io/api/?template=node-template
GET https://playground-staging.substrate.io/api/$INSTANCE_UUID
DELETE https://playground-staging.substrate.io/api/$INSTANCE_UUID
```

A local instance identified by its UUID can be manipulated:

```javascript
const instance = new Instance($UUID);
await instance.list(); //["vscode.open", ...]
await instance.execute("vscode.open", "/some/path");
```

Local instances can be discovered:

```javascript
const discoverer = new Discoverer((instance: Instance) => {
    console.log(`New instance discovered ${instance.uuid}`);
});
console.log(discoverer.instances);
```

# Quire Ink on Kubernetes

Four manifests, no chart, no tool to install. Kustomize is part of `kubectl`.

```
kubectl create namespace blog
# edit SITE_URL in kustomization.yaml, and the host in ingress.yaml
kubectl apply -k deploy/kubernetes -n blog
kubectl logs -n blog quire-0 | head -20     # the one-time link that claims the blog
```

About twenty seconds later the pod is ready. The claim link is printed at every boot until
somebody uses it, and it is built from `SITE_URL`, so getting that value right is the
difference between a link you can open and a link to `localhost`.

## The one thing to understand before you scale it

**This runs as exactly one pod, and that is not a limitation to work around.** The blog is
one Bun process over two SQLite files. SQLite has one writer; two pods on one volume is not
a bigger blog, it is a corrupted one, and nothing in Kubernetes will warn you.

That is why the workload is a **StatefulSet** and not a Deployment. A Deployment's rolling
update starts the replacement before it stops the original: against a ReadWriteOnce volume
that hangs on `Multi-Attach error` until it times out, and against a ReadWriteMany one it
works, which is the worse outcome. A StatefulSet stops the old pod and waits for it to be
gone. Measured on a v1.37 cluster during an image change: the pod count never left 1.

So: no `replicas: 2`, no HorizontalPodAutoscaler, no second copy for "high availability".
Give the node more CPU or more memory instead. If you need more than one blog, run more than
one release of this in more than one namespace, each with its own volume.

## What it asks of the cluster

| | |
|---|---|
| A default StorageClass | `do-block-storage` on DigitalOcean, `gp3`/`gp2` on EKS, `standard` on kind. Any RWO class will do; name one in `statefulset.yaml` only if you want a class that is not the default. |
| An ingress controller | Or delete `ingress.yaml` and terminate TLS somewhere else. |
| Nothing else | No database, no cache, no queue, no object store, no secret to generate. The app makes its own signing keys on first boot and keeps them in its database. |

`quire-secrets` is read if it exists and skipped if it does not. It is where `CRON_SECRET`
and `MCP_OAUTH_SECRET` belong on the installs that want them, and most do not:

```
kubectl create secret generic quire-secrets -n blog --from-literal=CRON_SECRET=...
```

## DigitalOcean

DOKS needs nothing added. The default StorageClass is `do-block-storage`, which is RWO block
storage in one zone, and a StatefulSet is the correct shape for it: the pod follows the
volume to its zone rather than the volume following the pod.

The reason to reach for DOKS over the droplet in [`../digitalocean/`](../digitalocean/README.md)
is if you already run a cluster. For one blog on its own, a droplet is one paste, one bill,
and no control-plane fee; this directory does not make it faster or cheaper, only
consistent with the rest of what you run.

**A managed load balancer is billed per hour, per balancer.** One ingress controller in
front of every service you run is one balancer; a `type: LoadBalancer` Service per app is
one each, which is why `service.yaml` is a ClusterIP.

## The trap that costs you an afternoon

`ingress.yaml` sets `nginx.ingress.kubernetes.io/proxy-body-size: "64m"`. **Do not drop
it.** ingress-nginx refuses a body over 1 MB by default, so without that annotation every
photo worth uploading is rejected by the proxy with a 413 that the app never sees: the admin
reports nothing wrong, the upload simply stops. Quire Ink's own ceiling is 64 MB
(`MAX_UPLOAD_MB`), and the two numbers should agree.

Reader addresses need no configuration. The app trusts `X-Forwarded-For` only from a
loopback or private-network peer, and an in-cluster ingress controller is on a private
address, so comment rate limits and analytics see the real visitor. Set `TRUST_PROXY=1` in
the ConfigMap only if yours reaches the pod from a public address.

## Backups

The volume is not a backup, and a volume snapshot of a live SQLite file is not one either.
Use the blog's own archive (Settings → System, or `/api/backup`), which quiesces the
databases before it writes: [`docs/backups.md`](../../docs/backups.md). Restoring is
[`scripts/restore-check.ts`](../../scripts/restore-check.ts)'s subject and works the same
way in a pod as anywhere else.

`kubectl delete -k deploy/kubernetes` does **not** delete the volume — a StatefulSet's
claims outlive it, which is the behaviour you want the day you delete the wrong thing.
Re-applying picks the same disk back up, blog intact. Removing the data is the separate,
deliberate `kubectl delete pvc data-quire-0`.

## Upgrading

The image tag is pinned in `statefulset.yaml` on purpose: `latest` on a StatefulSet is a pod
that changes underneath you at the next unrelated eviction, on a blog that migrates its
schema at boot. Change the tag, apply, and the schema is upgraded inside a transaction as
the new pod starts. Take a backup first.

## What has been proven, and what has not

Verified on 2026-08-31 against a local `kind` cluster (Kubernetes v1.37) using the published
`quireink/quireink:2.2.3` image:

- applies with `kubectl apply -k`, and the pod reaches Ready in about 20 seconds;
- runs as **UID 1000**, non-root, with the volume writable — no `chown` step, no init
  container, the image's entrypoint takes its own non-root path;
- serves `/api/health`, the home page and `feed.xml` through the ClusterIP Service, with the
  feed's links built from `SITE_URL`;
- **keeps its data across a pod replacement**: an account created inside the pod was still
  there after `kubectl delete pod`, on the reissued pod;
- **never runs two pods at once** during an image change;
- passes the **`restricted` Pod Security Standard** — applied into a namespace labelled
  `pod-security.kubernetes.io/enforce=restricted`, admitted with no warnings.

Not exercised here, and honest about it: DOKS itself, `do-block-storage`, a real
ingress-nginx controller, and cert-manager issuing a certificate. Those are each a provider's
own documented feature rather than something this repository can hold true — but the two
values they most often need are already written down above.

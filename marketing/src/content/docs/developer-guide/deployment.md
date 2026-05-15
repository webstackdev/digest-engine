# Deployment

## just build Contract

The `just build` target makes zero assumptions about the environment file. It uses `DOCKER_BUILDKIT=0` to ensure legacy build isolation and host image cache utilization. No `.env` copies are made during build time.

## Docker Compose

Used primarily for local testing and running the application on a single VPS. See [Admin Installation](../admin-guide/installation.md) for details.

## Helm Chart Layout

For Kubernetes deployments, a reusable Helm chart sits in `deploy/helm/`.

## Minikube Quick Start

Use this path when you want to run the stack on a local Kubernetes cluster instead of Docker Compose.

Prerequisites:

- `minikube`
- `kubectl`
- `helm`

Start Minikube and deploy the chart:

```bash
minikube start
just k8s-build-minikube
just helm-lint
just helm-template
just k8s-install-minikube
```

Forward the Nginx service locally:

```bash
kubectl port-forward svc/digest-engine-digest-engine-nginx 8080:80
```

Then open <http://localhost:8080/> in your browser.

To remove the local release:

```bash
just k8s-uninstall-minikube
```

## ArgoCD Application

We maintain an ArgoCD application manifest in `deploy/argocd/` to support GitOps continuous delivery.

## Staging Overlay

Staging branches utilize encrypted / sealed secrets (or external secret operators) pushed into the cluster.

## Prometheus ServiceMonitor

If deployed alongside the `kube-prometheus-stack`, the chart deploys a `ServiceMonitor` to scrape port 8000 for Django metrics exposed by `django-prometheus`.

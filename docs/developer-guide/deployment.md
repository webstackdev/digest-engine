# Deployment

## just build Contract
The `just build` target makes zero assumptions about the environment file. It uses `DOCKER_BUILDKIT=0` to ensure legacy build isolation and host image cache utilization. No `.env` copies are made during build time.

## Docker Compose
Used primarily for local testing and running the application on a single VPS. See [Admin Installation](../admin-guide/installation.md) for details.

## Helm Chart Layout
For Kubernetes deployments, a reusable Helm chart sits in `deploy/helm/`.

## ArgoCD Application
We maintain an ArgoCD application manifest in `deploy/argocd/` to support GitOps continuous delivery.

## Staging Overlay
Staging branches utilize encrypted / sealed secrets (or external secret operators) pushed into the cluster.

## Prometheus ServiceMonitor
If deployed alongside the `kube-prometheus-stack`, the chart deploys a `ServiceMonitor` to scrape port 8000 for Django metrics exposed by `django-prometheus`.

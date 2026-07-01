# Generic Observability Chart

This Helm chart deploys a generic, project-agnostic observability stack on Kubernetes. It is designed to plug directly into an existing monitoring setup and automatically visualize CPU, RAM, Disk, Network, and HTTP traffic metrics.

## What this chart installs
When deployed, this chart creates the following Kubernetes resources in the `monitoring` namespace:
- **ServiceMonitor**: Tells Prometheus to scrape the NGINX Ingress Controller to capture HTTP metrics (Requests/second, Requests/minute, and Status Codes).
- **PrometheusRule**: Creates background recording rules to pre-calculate CPU, memory, and disk usage for instant dashboard loading, along with built-in alerts for high resource usage and HTTP 5xx error rates.
- **ConfigMap (Grafana Dashboard)**: Injects a comprehensive JSON dashboard (`Generic Observability — Overview`) into Grafana via a sidecar label.

## Required Prerequisites
Before installing this chart, ensure the following are running in your cluster:
1. **[kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)**: Required for Prometheus Operator CRDs (ServiceMonitor, PrometheusRule) and Node Exporter metrics. 
   - *Important:* Ensure `grafana.sidecar.dashboards.enabled=true` is set.
2. **[ingress-nginx](https://kubernetes.github.io/ingress-nginx/)**: Required for HTTP traffic metrics.
   - *Important:* Ensure `controller.metrics.enabled=true` is set.

## Configurable Values
You can customize the deployment by modifying `values.yaml` or overriding them using `--set` during installation.

| Key | Default | Description |
|---|---|---|
| `project` | `my-project` | Human-readable tag shown in the dashboard annotations to filter multiple projects. |
| `monitoringNamespace` | `monitoring` | The namespace where your Prometheus and Grafana instances live. |
| `grafana.dashboardLabel` | `grafana_dashboard` | The label key that the Grafana sidecar watches for auto-importing dashboards. |
| `grafana.dashboardLabelValue` | `"1"` | The label value required by the Grafana sidecar. |
| `nginxIngress.enabled` | `true` | Whether to create the ServiceMonitor for NGINX metrics. |
| `nginxIngress.namespace` | `ingress-nginx` | The namespace where NGINX Ingress Controller is running. |
| `prometheusRule.alerts.cpuUsagePercent` | `85` | Threshold (%) to trigger a High CPU usage alert. |
| `prometheusRule.alerts.memUsagePercent` | `90` | Threshold (%) to trigger a High Memory usage alert. |
| `prometheusRule.alerts.http5xxErrorPercent` | `5` | Threshold (%) for HTTP 5xx errors to trigger an alert. |

## Installation Command
To install the chart and specify your project name, run the following Helm command from your bash terminal:

```bash
helm upgrade --install generic-observability /media/sf_SHARED/helm-charts/charts/generic-observability \
  --namespace monitoring --create-namespace \
  --set project="my-cool-web-app"
```

*(Note: Replace the absolute path if you are running this from a different location).*

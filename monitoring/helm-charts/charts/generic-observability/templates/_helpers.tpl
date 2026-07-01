{{/*
Expand the name of the chart.
*/}}
{{- define "generic-observability.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "generic-observability.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "generic-observability.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "generic-observability.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "generic-observability.selectorLabels" -}}
app.kubernetes.io/name: {{ include "generic-observability.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Namespace for Grafana dashboard ConfigMaps.
Falls back to monitoringNamespace if dashboardsConfigMapNamespace is empty.
*/}}
{{- define "generic-observability.dashboardNamespace" -}}
{{- if .Values.grafana.dashboardsConfigMapNamespace -}}
{{ .Values.grafana.dashboardsConfigMapNamespace }}
{{- else -}}
{{ .Values.monitoringNamespace }}
{{- end -}}
{{- end }}

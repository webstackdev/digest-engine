{{- define "digest-engine.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "digest-engine.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "digest-engine.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "digest-engine.secretName" -}}
{{- if .Values.secrets.existingSecretName -}}
{{- .Values.secrets.existingSecretName | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-secret" (include "digest-engine.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "digest-engine.labels" -}}
app.kubernetes.io/name: {{ include "digest-engine.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "digest-engine.selectorLabels" -}}
app.kubernetes.io/name: {{ include "digest-engine.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "digest-engine.componentLabels" -}}
{{ include "digest-engine.selectorLabels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "digest-engine.databaseHost" -}}
{{- printf "%s-postgres" (include "digest-engine.fullname" .) -}}
{{- end -}}

{{- define "digest-engine.redisHost" -}}
{{- printf "%s-redis" (include "digest-engine.fullname" .) -}}
{{- end -}}

{{- define "digest-engine.qdrantHost" -}}
{{- printf "%s-qdrant" (include "digest-engine.fullname" .) -}}
{{- end -}}

{{- define "digest-engine.djangoHost" -}}
{{- printf "%s-django" (include "digest-engine.fullname" .) -}}
{{- end -}}

{{- define "digest-engine.databaseUrl" -}}
{{- printf "postgresql://%s:%s@%s:%v/%s" .Values.postgres.username .Values.postgres.password (include "digest-engine.databaseHost" .) .Values.postgres.service.port .Values.postgres.database -}}
{{- end -}}

{{- define "digest-engine.redisUrl" -}}
{{- printf "redis://%s:%v/0" (include "digest-engine.redisHost" .) .Values.redis.service.port -}}
{{- end -}}

{{- define "digest-engine.qdrantUrl" -}}
{{- printf "http://%s:%v" (include "digest-engine.qdrantHost" .) .Values.qdrant.service.port -}}
{{- end -}}

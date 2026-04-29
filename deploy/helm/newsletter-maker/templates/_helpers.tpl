{{- define "newsletter-maker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "newsletter-maker.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "newsletter-maker.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "newsletter-maker.labels" -}}
app.kubernetes.io/name: {{ include "newsletter-maker.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "newsletter-maker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "newsletter-maker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "newsletter-maker.componentLabels" -}}
{{ include "newsletter-maker.selectorLabels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "newsletter-maker.databaseHost" -}}
{{- printf "%s-postgres" (include "newsletter-maker.fullname" .) -}}
{{- end -}}

{{- define "newsletter-maker.redisHost" -}}
{{- printf "%s-redis" (include "newsletter-maker.fullname" .) -}}
{{- end -}}

{{- define "newsletter-maker.qdrantHost" -}}
{{- printf "%s-qdrant" (include "newsletter-maker.fullname" .) -}}
{{- end -}}

{{- define "newsletter-maker.djangoHost" -}}
{{- printf "%s-django" (include "newsletter-maker.fullname" .) -}}
{{- end -}}

{{- define "newsletter-maker.databaseUrl" -}}
{{- printf "postgresql://%s:%s@%s:%v/%s" .Values.postgres.username .Values.postgres.password (include "newsletter-maker.databaseHost" .) .Values.postgres.service.port .Values.postgres.database -}}
{{- end -}}

{{- define "newsletter-maker.redisUrl" -}}
{{- printf "redis://%s:%v/0" (include "newsletter-maker.redisHost" .) .Values.redis.service.port -}}
{{- end -}}

{{- define "newsletter-maker.qdrantUrl" -}}
{{- printf "http://%s:%v" (include "newsletter-maker.qdrantHost" .) .Values.qdrant.service.port -}}
{{- end -}}

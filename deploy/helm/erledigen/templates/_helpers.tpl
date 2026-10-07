{{/*
Common naming for the erledigen chart.
*/}}
{{- define "erledigen.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "erledigen.fullname" -}}
{{- printf "%s" (include "erledigen.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* The server image reference (registry/owner/name:tag). */}}
{{- define "erledigen.serverImage" -}}
{{- printf "%s/%s/erledigen-server:%s" .Values.image.registry .Values.image.owner .Values.image.tag -}}
{{- end -}}

{{/* The client image reference. */}}
{{- define "erledigen.clientImage" -}}
{{- printf "%s/%s/erledigen-client:%s" .Values.image.registry .Values.image.owner .Values.image.tag -}}
{{- end -}}

{{/* Standard labels. */}}
{{- define "erledigen.labels" -}}
app.kubernetes.io/name: {{ include "erledigen.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}